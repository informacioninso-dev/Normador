from rest_framework import serializers

from apps.common.choices import ReviewType
from apps.reviews.models import DocumentReview, Finding, RequirementEvaluation


class RequirementEvaluationSerializer(serializers.ModelSerializer):
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    clause = serializers.CharField(source="requirement.clause", read_only=True)
    process_area = serializers.CharField(source="requirement.process_area", read_only=True)

    class Meta:
        model = RequirementEvaluation
        fields = [
            "id",
            "document_review",
            "requirement",
            "requirement_title",
            "clause",
            "process_area",
            "status",
            "evidence_found",
            "gap",
            "risk_level",
            "recommendation",
            "suggested_text",
            "can_close_requirement",
            "requires_real_evidence",
            "missing_documents_or_evidence",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class FindingSerializer(serializers.ModelSerializer):
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)

    class Meta:
        model = Finding
        fields = [
            "id",
            "project",
            "document_review",
            "requirement",
            "requirement_title",
            "finding_type",
            "description",
            "risk_level",
            "root_cause_suggestion",
            "recommended_action",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DocumentReviewSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    standard_name = serializers.CharField(source="standard.name", read_only=True)
    requirement_evaluations = RequirementEvaluationSerializer(many=True, read_only=True)
    findings = FindingSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentReview
        fields = [
            "id",
            "document",
            "document_title",
            "project",
            "project_name",
            "standard",
            "standard_name",
            "review_type",
            "overall_status",
            "risk_level",
            "summary",
            "prompt_version",
            "system_prompt_used",
            "user_prompt_used",
            "raw_response",
            "retrieved_context",
            "ai_model_used",
            "created_by",
            "requirement_evaluations",
            "findings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DocumentReviewRunSerializer(serializers.Serializer):
    document = serializers.IntegerField()
    standard = serializers.IntegerField(required=False)
    review_type = serializers.ChoiceField(choices=ReviewType.choices)
    requirements = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
