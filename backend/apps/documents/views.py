from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ai_engine.ollama_client import OllamaAPIError
from apps.ai_engine.retriever import search_chunks
from apps.documents.models import Document, DocumentChunk
from apps.documents.serializers import (
    DocumentChunkSerializer,
    DocumentSerializer,
    DocumentWriteSerializer,
)
from apps.documents.services import index_document_chunks, process_document
from apps.common.choices import DocumentProcessingStatus


class DocumentViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return DocumentWriteSerializer
        return DocumentSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.select_related(
            "project",
            "library_standard",
            "library_company",
            "library_project",
            "requirement",
            "checklist_item",
            "uploaded_by",
        ).annotate(chunk_count=Count("chunks"))

        # Non-staff users only see their own project docs and global library docs
        if not user.is_staff:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(is_reference=True) | Q(project__company__created_by=user)
            )

        project_id = self.request.query_params.get("project")
        is_reference = self.request.query_params.get("is_reference")
        document_type = self.request.query_params.get("document_type")
        status_code = self.request.query_params.get("status")
        checklist_item_id = self.request.query_params.get("checklist_item")
        requirement_id = self.request.query_params.get("requirement")
        library_standard_id = self.request.query_params.get("library_standard")
        library_company_id = self.request.query_params.get("library_company")
        library_project_id = self.request.query_params.get("library_project")
        library_kind = self.request.query_params.get("library_kind")
        library_usage = self.request.query_params.get("library_usage")
        process_area = self.request.query_params.get("process_area")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if is_reference is not None:
            queryset = queryset.filter(is_reference=is_reference.lower() in {"true", "1", "yes"})
        if document_type:
            queryset = queryset.filter(document_type=document_type)
        if status_code:
            queryset = queryset.filter(status=status_code)
        if checklist_item_id:
            queryset = queryset.filter(checklist_item_id=checklist_item_id)
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        if library_standard_id:
            queryset = queryset.filter(library_standard_id=library_standard_id)
        if library_company_id:
            queryset = queryset.filter(library_company_id=library_company_id)
        if library_project_id:
            queryset = queryset.filter(library_project_id=library_project_id)
        if library_kind:
            queryset = queryset.filter(library_kind=library_kind)
        if library_usage:
            matching_ids = [
                document.id
                for document in queryset
                if _library_usage_allowed(document, library_usage)
            ]
            queryset = Document.objects.filter(id__in=matching_ids)
        if process_area:
            queryset = queryset.filter(process_area__iexact=process_area)

        return queryset.order_by("-uploaded_at", "-id")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_by = request.user if request.user.is_authenticated else None
        document = serializer.save(uploaded_by=uploaded_by)
        process_document(document)
        read_serializer = DocumentSerializer(document, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        document = self.get_object()
        if hasattr(document, "control_revision"):
            return Response({"detail": "Crea una nueva version desde Control documental."}, status=400)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        if hasattr(document, "control_revision"):
            return Response({"detail": "Archiva el documento desde Control documental."}, status=400)
        document.status = DocumentProcessingStatus.ARCHIVED
        document.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = self.get_object()
        if document.status == DocumentProcessingStatus.ARCHIVED:
            return Response({"detail": "Un documento archivado no puede reprocesarse."}, status=400)
        process_document(document)
        serializer = DocumentSerializer(document, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def index_chunks(self, request, pk=None):
        document = self.get_object()
        overwrite = str(request.data.get("overwrite", "true")).strip().lower() not in {
            "0",
            "false",
            "no",
        }
        try:
            summary = index_document_chunks(
                document,
                overwrite=overwrite,
                created_by=request.user if request.user.is_authenticated else None,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except OllamaAPIError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        serializer = DocumentSerializer(document, context=self.get_serializer_context())
        return Response({"document": serializer.data, **summary})


class DocumentChunkViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentChunkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DocumentChunk.objects.select_related(
            "document",
            "document__project",
        )
        project_id = self.request.query_params.get("project")
        document_id = self.request.query_params.get("document")
        requirement_id = self.request.query_params.get("requirement")
        status_code = self.request.query_params.get("embedding_status")
        document_type = self.request.query_params.get("document_type")
        is_reference = self.request.query_params.get("is_reference")
        library_standard_id = self.request.query_params.get("library_standard")
        library_company_id = self.request.query_params.get("library_company")
        library_project_id = self.request.query_params.get("library_project")
        library_kind = self.request.query_params.get("library_kind")
        library_usage = self.request.query_params.get("library_usage")
        process_area = self.request.query_params.get("process_area")

        if project_id:
            queryset = queryset.filter(document__project_id=project_id)
        if document_id:
            queryset = queryset.filter(document_id=document_id)
        if requirement_id:
            queryset = queryset.filter(document__requirement_id=requirement_id)
        if status_code:
            queryset = queryset.filter(embedding_status=status_code)
        if document_type:
            queryset = queryset.filter(document__document_type=document_type)
        if is_reference is not None:
            queryset = queryset.filter(document__is_reference=is_reference.lower() in {"true", "1", "yes"})
        if library_standard_id:
            queryset = queryset.filter(document__library_standard_id=library_standard_id)
        if library_company_id:
            queryset = queryset.filter(document__library_company_id=library_company_id)
        if library_project_id:
            queryset = queryset.filter(document__library_project_id=library_project_id)
        if library_kind:
            queryset = queryset.filter(document__library_kind=library_kind)
        if library_usage:
            matching_ids = [
                chunk.id
                for chunk in queryset
                if _library_usage_allowed(chunk.document, library_usage)
            ]
            queryset = DocumentChunk.objects.filter(id__in=matching_ids)
        if process_area:
            queryset = queryset.filter(document__process_area__iexact=process_area)

        return queryset.order_by("document_id", "chunk_index", "id")

    @action(detail=False, methods=["post"])
    def semantic_search(self, request):
        query = (request.data.get("query") or "").strip()
        if not query:
            return Response(
                {"query": "This field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = request.data.get("limit")
        try:
            results = search_chunks(
                query,
                project_id=request.data.get("project"),
                document_id=request.data.get("document"),
                requirement_id=request.data.get("requirement"),
                standard_id=request.data.get("standard"),
                document_type=request.data.get("document_type"),
                limit=int(limit) if limit else None,
            )
        except OllamaAPIError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        serializer = self.get_serializer([result.chunk for result in results], many=True)
        return Response(
            {
                "query": query,
                "count": len(results),
                "results": serializer.data,
            }
        )


def _library_usage_allowed(document: Document, usage: str) -> bool:
    usages = document.library_usages or []
    return not usages or usage in usages or "GENERAL" in usages
