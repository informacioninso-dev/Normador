import hashlib
import math
import re
import time
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings

from apps.ai_engine.models import AIProviderLog
from apps.ai_engine.ollama_client import OllamaClient
from apps.common.choices import AILogStatus, AIOperationType, AIProvider, EmbeddingStatus
from apps.documents.models import Document, DocumentChunk


TOKEN_PATTERN = re.compile(r"\w+", re.UNICODE)


class EmbeddingProvider(Protocol):
    provider_name: str
    model_name: str

    def embed_texts(self, texts: list[str]) -> tuple[list[list[float]], dict]:
        ...


@dataclass
class OllamaEmbeddingProvider:
    model_name: str
    client: OllamaClient
    provider_name: str = AIProvider.OLLAMA

    def embed_texts(self, texts: list[str]) -> tuple[list[list[float]], dict]:
        response = self.client.embed(model=self.model_name, inputs=texts)
        embeddings = response.get("embeddings", [])
        return embeddings, response


@dataclass
class MockEmbeddingProvider:
    model_name: str = "mock-embedding-v1"
    dimensions: int = 64
    provider_name: str = AIProvider.MOCK

    def embed_texts(self, texts: list[str]) -> tuple[list[list[float]], dict]:
        embeddings = [self._embed_single(text) for text in texts]
        return embeddings, {"embedding_count": len(embeddings), "dimensions": self.dimensions}

    def _embed_single(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = TOKEN_PATTERN.findall((text or "").lower())
        if not tokens:
            return vector

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % self.dimensions
            sign = -1.0 if digest[2] % 2 else 1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]


def get_default_embedding_provider() -> EmbeddingProvider:
    if settings.AI_PROVIDER == AIProvider.MOCK:
        return MockEmbeddingProvider()

    return OllamaEmbeddingProvider(
        model_name=settings.OLLAMA_EMBEDDING_MODEL,
        client=OllamaClient(),
    )


def embed_document_chunks(
    document: Document,
    *,
    provider: EmbeddingProvider | None = None,
    created_by=None,
) -> int:
    chunks = list(document.chunks.order_by("chunk_index", "id"))
    if not chunks:
        return 0

    provider = provider or get_default_embedding_provider()
    texts = [chunk.content for chunk in chunks]

    for chunk in chunks:
        chunk.embedding_status = EmbeddingStatus.PROCESSING
        chunk.embedding_error = ""
    DocumentChunk.objects.bulk_update(chunks, ["embedding_status", "embedding_error"])

    request_summary = {
        "document_id": document.id,
        "chunk_count": len(chunks),
        "provider": provider.provider_name,
        "model": provider.model_name,
    }
    started = time.perf_counter()

    try:
        embeddings, raw_response = provider.embed_texts(texts)
        duration_ms = int((time.perf_counter() - started) * 1000)

        if len(embeddings) != len(chunks):
            raise ValueError("Embedding provider returned a different number of embeddings")

        for chunk, vector in zip(chunks, embeddings):
            chunk.embedding = vector
            chunk.embedding_dimensions = len(vector)
            chunk.embedding_provider = provider.provider_name
            chunk.embedding_model = provider.model_name
            chunk.embedding_status = EmbeddingStatus.READY
            chunk.embedding_error = ""

        DocumentChunk.objects.bulk_update(
            chunks,
            [
                "embedding",
                "embedding_dimensions",
                "embedding_provider",
                "embedding_model",
                "embedding_status",
                "embedding_error",
            ],
        )

        AIProviderLog.objects.create(
            provider=provider.provider_name,
            model_name=provider.model_name,
            operation_type=AIOperationType.EMBEDDING,
            status=AILogStatus.SUCCESS,
            request_payload=request_summary,
            response_payload={
                "embedding_count": len(embeddings),
                "dimensions": len(embeddings[0]) if embeddings else 0,
                "provider_meta": {
                    key: value
                    for key, value in raw_response.items()
                    if key != "embeddings"
                }
                if isinstance(raw_response, dict)
                else {},
            },
            latency_ms=duration_ms,
            created_by=created_by,
        )
        return len(chunks)
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        for chunk in chunks:
            chunk.embedding = []
            chunk.embedding_dimensions = 0
            chunk.embedding_provider = provider.provider_name
            chunk.embedding_model = provider.model_name
            chunk.embedding_status = EmbeddingStatus.FAILED
            chunk.embedding_error = str(exc)
        DocumentChunk.objects.bulk_update(
            chunks,
            [
                "embedding",
                "embedding_dimensions",
                "embedding_provider",
                "embedding_model",
                "embedding_status",
                "embedding_error",
            ],
        )

        AIProviderLog.objects.create(
            provider=provider.provider_name,
            model_name=provider.model_name,
            operation_type=AIOperationType.EMBEDDING,
            status=AILogStatus.ERROR,
            request_payload=request_summary,
            response_payload={},
            error_message=str(exc),
            latency_ms=duration_ms,
            created_by=created_by,
        )
        raise
