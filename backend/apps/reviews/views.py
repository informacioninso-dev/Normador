from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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


class DocumentReviewViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentReviewSerializer

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

        return queryset.order_by("-created_at", "-id")

    def create(self, request, *args, **kwargs):
        serializer = DocumentReviewRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = Document.objects.filter(id=serializer.validated_data["document"]).first()
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


class RequirementEvaluationViewSet(
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


class FindingViewSet(
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
