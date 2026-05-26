from rest_framework import serializers

from apps.standards.models import Standard, StandardRequirement


class StandardRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StandardRequirement
        fields = [
            "id",
            "standard",
            "clause",
            "title",
            "requirement_text",
            "process_area",
            "criticality",
            "expected_documents",
            "expected_evidence",
            "verification_questions",
            "requires_real_evidence",
            "required_document_type",
            "required_evidence_type",
            "sequence",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StandardSerializer(serializers.ModelSerializer):
    requirement_count = serializers.SerializerMethodField()

    def get_requirement_count(self, obj):
        return getattr(obj, "requirement_count", obj.requirements.count())

    class Meta:
        model = Standard
        fields = [
            "id",
            "code",
            "name",
            "description",
            "version",
            "country",
            "is_active",
            "requirement_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "requirement_count", "created_at", "updated_at"]
