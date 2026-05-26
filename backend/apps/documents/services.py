import hashlib
from pathlib import Path

from django.conf import settings

from apps.ai_engine.chunker import chunk_text
from apps.ai_engine.embeddings import embed_document_chunks
from apps.common.choices import DocumentProcessingStatus
from apps.documents.extractor import extract_document
from apps.documents.models import Document, DocumentChunk
from apps.implementation.services import recalculate_checklist_item_state, resolve_project_checklist_item


def process_document(document: Document) -> Document:
    document.status = DocumentProcessingStatus.PROCESSING
    document.processing_error = ""
    document.save(update_fields=["status", "processing_error"])

    try:
        extracted_text, extracted_metadata = extract_document(Path(document.file.path))
        document.extracted_text = extracted_text
        document.extracted_metadata = extracted_metadata
        document.status = DocumentProcessingStatus.READY
        document.processing_error = ""
        document.save(
            update_fields=[
                "extracted_text",
                "extracted_metadata",
                "status",
                "processing_error",
            ]
        )
        _sync_related_checklist_state(document)
    except Exception as exc:
        document.extracted_text = ""
        document.extracted_metadata = {}
        document.status = DocumentProcessingStatus.FAILED
        document.processing_error = str(exc)
        document.save(
            update_fields=[
                "extracted_text",
                "extracted_metadata",
                "status",
                "processing_error",
            ]
        )

    return document


def _sync_related_checklist_state(document: Document) -> None:
    checklist_item = document.checklist_item

    if checklist_item is None and document.requirement_id:
        checklist_item = resolve_project_checklist_item(document.project, document.requirement_id)
        if checklist_item:
            document.checklist_item = checklist_item
            document.save(update_fields=["checklist_item"])

    if checklist_item:
        recalculate_checklist_item_state(checklist_item)


def index_document_chunks(
    document: Document,
    *,
    overwrite: bool = True,
    provider=None,
    created_by=None,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> dict:
    if document.status != DocumentProcessingStatus.READY:
        raise ValueError("Document must be in LISTO status before indexing chunks.")
    if not document.extracted_text.strip():
        raise ValueError("Document does not contain extracted text to chunk.")

    if overwrite:
        document.chunks.all().delete()

    payloads = chunk_text(
        document.extracted_text,
        chunk_size=chunk_size or settings.CHUNK_SIZE_WORDS,
        overlap=overlap or settings.CHUNK_OVERLAP_WORDS,
    )

    chunks = [
        DocumentChunk(
            document=document,
            chunk_index=payload.chunk_index,
            content=payload.content,
            content_hash=hashlib.sha256(payload.content.encode("utf-8")).hexdigest(),
            word_count=payload.word_count,
            character_start=payload.character_start,
            character_end=payload.character_end,
            metadata=payload.metadata,
        )
        for payload in payloads
    ]
    if chunks:
        DocumentChunk.objects.bulk_create(chunks)

    created_chunks = len(chunks)
    embedded_chunks = embed_document_chunks(document, provider=provider, created_by=created_by)
    return {
        "created_chunks": created_chunks,
        "embedded_chunks": embedded_chunks,
    }
