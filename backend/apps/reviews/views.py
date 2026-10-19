from apps.companies.api_access import CompanyScopedViewMixin
from apps.companies.access import scope_queryset, WRITE_ROLES
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.ai_engine.ollama_client import OllamaAPIError
from apps.documents.models import Document
from apps.reviews.iso_reviewer import ReviewProviderError, run_document_review
from apps.reviews.models import DocumentReview, Finding, RequirementEvaluation
from apps.reviews.serializers import (
    DocumentReviewRunSerializer,
    DocumentReviewSerializer,
    FindingSerializer,
    RequirementEvaluationSerializer,
)
from apps.standards.models import Standard


class DocumentReviewViewSet(CompanyScopedViewMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentReviewSerializer

    @action(detail=False, methods=["post"])
    def enqueue(self, request):
        from apps.documents.models import DocumentProcessingJob
        from apps.documents.tasks import enqueue_document
        from apps.documents.serializers import ProcessingJobSerializer
        serializer = DocumentReviewRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = scope_queryset(Document.objects.select_related("project"), request.user, WRITE_ROLES, allow_global=False).filter(pk=serializer.validated_data["document"]).first()
        if document is None:
            return Response({"document": "Documento no disponible para revisión."}, status=400)
        if document.status != "LISTO" or not document.project_id:
            return Response({"document": "El documento debe estar listo y pertenecer a un proyecto."}, status=400)
        standard_id = serializer.validated_data.get("standard", document.project.standard_id)
        requirements = serializer.validated_data.get("requirements")
        if standard_id != document.project.standard_id:
            return Response({"standard": "La norma no corresponde al proyecto."}, status=400)
        if requirements and document.project.standard.requirements.filter(pk__in=requirements).count() != len(set(requirements)):
            return Response({"requirements": "Los requisitos deben pertenecer a la norma del proyecto."}, status=400)
        options = {"review_type": serializer.validated_data["review_type"], "requirements": requirements}
        job = enqueue_document(document, user=request.user, operation=DocumentProcessingJob.Operation.REVIEW, review_options=options)
        if job.operation != "REVIEW" or job.review_options != options:
            return Response({"detail": "Este documento ya tiene otro trabajo activo. Espera a que termine."}, status=409)
        if job.status == "FAILED":
            return Response({"detail": job.error, "job": ProcessingJobSerializer(job).data}, status=503)
        return Response(ProcessingJobSerializer(job).data, status=202)

    def get_queryset(self):
        queryset = DocumentReview.objects.select_related(
            "document",
            "project",
            "standard",
            "created_by",
        ).prefetch_related("requirement_evaluations__requirement", "findings__requirement")
        document_id = self.request.query_params.get("document")
        project_id = self.request.query_params.get("project")
        review_type = self.request.query_params.get("review_type")

        if document_id:
            queryset = queryset.filter(document_id=document_id)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if review_type:
            queryset = queryset.filter(review_type=review_type)

        if self.request.query_params.get("summary") == "true":
            queryset = queryset.defer("system_prompt_used", "user_prompt_used", "raw_response", "retrieved_context")
        return queryset.order_by("-created_at", "-id")

    def create(self, request, *args, **kwargs):
        serializer = DocumentReviewRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = scope_queryset(Document.objects.all(), request.user, WRITE_ROLES, allow_global=False).filter(id=serializer.validated_data["document"]).first()
        if document is None:
            return Response(
                {"document": "Document not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        standard_id = serializer.validated_data.get("standard")
        standard = None
        if standard_id is not None:
            standard = Standard.objects.filter(id=standard_id).first()
            if standard is None:
                return Response(
                    {"standard": "Standard not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            review = run_document_review(
                document=document,
                standard=standard,
                review_type=serializer.validated_data["review_type"],
                requirement_ids=serializer.validated_data.get("requirements"),
                created_by=request.user if request.user.is_authenticated else None,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except (OllamaAPIError, ReviewProviderError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        read_serializer = self.get_serializer(review)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)


class RequirementEvaluationViewSet(CompanyScopedViewMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = RequirementEvaluationSerializer

    def get_queryset(self):
        queryset = RequirementEvaluation.objects.select_related(
            "document_review",
            "requirement",
            "document_review__document",
        )
        review_id = self.request.query_params.get("review")
        requirement_id = self.request.query_params.get("requirement")
        status_code = self.request.query_params.get("status")

        if review_id:
            queryset = queryset.filter(document_review_id=review_id)
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        if status_code:
            queryset = queryset.filter(status=status_code)

        return queryset.order_by("document_review_id", "requirement__sequence", "id")


class FindingViewSet(CompanyScopedViewMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = FindingSerializer

    def get_queryset(self):
        queryset = Finding.objects.select_related(
            "project",
            "document_review",
            "requirement",
        )
        project_id = self.request.query_params.get("project")
        review_id = self.request.query_params.get("review")
        requirement_id = self.request.query_params.get("requirement")
        status_code = self.request.query_params.get("status")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if review_id:
            queryset = queryset.filter(document_review_id=review_id)
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        if status_code:
            queryset = queryset.filter(status=status_code)

        return queryset.order_by("-created_at", "-id")
