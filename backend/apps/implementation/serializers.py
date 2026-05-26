from rest_framework import serializers

from apps.implementation.models import ImplementationChecklistItem, Project


class ProjectSerializer(serializers.ModelSerializer):
    checklist_items_count = serializers.SerializerMethodField()
    company_name = serializers.CharField(source="company.name", read_only=True)
    standard_name = serializers.CharField(source="standard.name", read_only=True)

    def get_checklist_items_count(self, obj):
        return getattr(obj, "checklist_items_count", obj.checklist_items.count())

    class Meta:
        model = Project
        fields = [
            "id",
            "company",
            "company_name",
            "standard",
            "standard_name",
            "name",
            "scope",
            "status",
            "start_date",
            "target_date",
            "checklist_items_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company_name",
            "standard_name",
            "checklist_items_count",
            "created_at",
            "updated_at",
        ]


class ImplementationChecklistItemSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    clause = serializers.CharField(source="requirement.clause", read_only=True)
    process_area = serializers.CharField(source="requirement.process_area", read_only=True)
    criticality = serializers.CharField(source="requirement.criticality", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    requires_real_evidence = serializers.BooleanField(
        source="requirement.requires_real_evidence",
        read_only=True,
    )

    class Meta:
        model = ImplementationChecklistItem
        fields = [
            "id",
            "project",
            "project_name",
            "requirement",
            "requirement_title",
            "clause",
            "process_area",
            "criticality",
            "title",
            "description",
            "status",
            "progress_percentage",
            "required_document_type",
            "required_evidence_type",
            "requires_real_evidence",
            "assigned_to",
            "due_date",
            "is_not_applicable",
            "not_applicable_justification",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "project_name",
            "requirement",
            "requirement_title",
            "clause",
            "process_area",
            "criticality",
            "requires_real_evidence",
            "created_at",
            "updated_at",
        ]
