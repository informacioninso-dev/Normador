from dataclasses import dataclass

import numpy as np
from django.conf import settings
from django.db import connection
from django.db.models import Q
from pgvector.django import CosineDistance

from apps.ai_engine.embeddings import (
    EmbeddingProvider,
    get_default_embedding_provider,
    validate_vectors,
)
from apps.common.choices import DocumentProcessingStatus, EmbeddingStatus
from apps.documents.models import DocumentChunk


@dataclass
class RetrievalResult:
    chunk: DocumentChunk
    score: float


def search_chunks(
    query: str,
    *,
    provider: EmbeddingProvider | None = None,
    project_id: int | None = None,
    document_id: int | None = None,
    requirement_id: int | None = None,
    standard_id: int | None = None,
    document_type: str | None = None,
    clause: str | None = None,
    library_only: bool = False,
    include_library: bool = False,
    library_usage: str | None = None,
    library_kind: str | None = None,
    process_area: str | None = None,
    limit: int | None = None,
    user=None,
) -> list[RetrievalResult]:
    """Search document chunks by semantic similarity.

    library_only=True  → only reference library docs (is_reference=True).
    include_library=True → project docs matching other filters PLUS library docs.
    """
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    provider = provider or get_default_embedding_provider()
    query_embeddings, _ = provider.embed_texts([normalized_query])
    if not query_embeddings:
        return []

    validate_vectors(query_embeddings, count=1)
    query_vector = np.array(query_embeddings[0], dtype=float)
    query_norm = np.linalg.norm(query_vector)
    if query_norm == 0:
        return []

    queryset = (
        DocumentChunk.objects.select_related(
            "document",
            "document__project",
            "document__library_standard",
            "document__library_company",
            "document__library_project",
            "document__requirement",
            "document__checklist_item",
        )
        .filter(
            embedding_status=EmbeddingStatus.READY,
            embedding_provider=provider.provider_name,
            embedding_model=provider.model_name,
            embedding_dimensions=len(query_vector),
            document__status=DocumentProcessingStatus.READY,
        )
        .exclude(document__status=DocumentProcessingStatus.ARCHIVED)
    )
    if user is not None:
        from apps.companies.access import scope_queryset

        queryset = scope_queryset(queryset, user)

    if library_only:
        queryset = queryset.filter(document__is_reference=True)
        queryset = _filter_library_scope(
            queryset,
            project_id=project_id,
            standard_id=standard_id,
        )
        if library_kind:
            queryset = queryset.filter(document__library_kind=library_kind)
        if process_area:
            queryset = queryset.filter(
                Q(document__process_area__iexact=process_area)
                | Q(document__process_area="")
            )
    elif include_library:
        library_ids = _filter_library_scope(
            queryset.filter(document__is_reference=True),
            project_id=project_id,
            standard_id=standard_id,
        ).values("pk")
        library_q = Q(pk__in=library_ids)
        project_q = Q(document__is_reference=False)
        if project_id:
            project_q &= Q(document__project_id=project_id)
        if document_id:
            project_q &= Q(document_id=document_id)
        if requirement_id:
            project_q &= Q(document__requirement_id=requirement_id)
        if standard_id:
            project_q &= Q(document__project__standard_id=standard_id)
        queryset = queryset.filter(library_q | project_q)
        if document_type:
            queryset = queryset.filter(document__document_type=document_type)
    else:
        if project_id:
            queryset = queryset.filter(document__project_id=project_id)
        if document_id:
            queryset = queryset.filter(document_id=document_id)
        if requirement_id:
            queryset = queryset.filter(document__requirement_id=requirement_id)
        if standard_id:
            queryset = queryset.filter(document__project__standard_id=standard_id)
        if document_type:
            queryset = queryset.filter(document__document_type=document_type)

    if clause:
        queryset = queryset.filter(
            Q(document__requirement__clause=clause)
            | Q(document__checklist_item__requirement__clause=clause)
            | Q(metadata__clause=clause)
        )
    result_limit = limit or settings.SEMANTIC_SEARCH_TOP_K
    if connection.vendor == "postgresql":
        if library_usage:
            queryset = queryset.filter(
                Q(document__is_reference=False)
                | Q(document__library_usages=[])
                | Q(document__library_usages__contains=[library_usage])
                | Q(document__library_usages__contains=["GENERAL"])
            )
        # Tenant, model and dimension filters are applied before SQL ranking/limit.
        ranked = (
            queryset.filter(embedding_vector__isnull=False)
            .annotate(
                distance=CosineDistance("embedding_vector", query_vector.tolist())
            )
            .order_by("distance", "pk")[:result_limit]
        )
        results = []
        for chunk in ranked:
            score = 1 - float(chunk.distance)
            chunk.similarity_score = round(score, 6)
            results.append(RetrievalResult(chunk=chunk, score=score))
        return results

    scored_results: list[RetrievalResult] = []
    for chunk in queryset:
        if not _library_usage_allowed(chunk, library_usage):
            continue
        vector = np.array(chunk.embedding or [], dtype=float)
        if vector.size == 0 or vector.shape[0] != query_vector.shape[0]:
            continue
        chunk_norm = np.linalg.norm(vector)
        if chunk_norm == 0:
            continue

        score = float(np.dot(query_vector, vector) / (query_norm * chunk_norm))
        chunk.similarity_score = round(score, 6)
        scored_results.append(RetrievalResult(chunk=chunk, score=score))

    scored_results.sort(key=lambda item: item.score, reverse=True)
    return scored_results[:result_limit]


def _filter_library_scope(queryset, *, project_id: int | None, standard_id: int | None):
    global_scope = Q(
        document__project__isnull=True,
        document__library_company__isnull=True,
        document__library_project__isnull=True,
    )

    project = None
    if project_id:
        from apps.implementation.models import Project

        project = (
            Project.objects.filter(id=project_id)
            .only("id", "company_id", "standard_id")
            .first()
        )
        if project:
            standard_id = standard_id or project.standard_id
            global_scope |= Q(
                document__library_project_id=project.id,
                document__library_company_id=project.company_id,
            )
            global_scope |= Q(
                document__library_company_id=project.company_id,
                document__library_project__isnull=True,
            )

    if standard_id:
        global_scope &= Q(document__library_standard_id=standard_id) | Q(
            document__library_standard__isnull=True
        )

    return queryset.filter(global_scope)


def _library_usage_allowed(chunk: DocumentChunk, library_usage: str | None) -> bool:
    if not library_usage or not chunk.document.is_reference:
        return True
    usages = chunk.document.library_usages or []
    return not usages or library_usage in usages or "GENERAL" in usages
