from decimal import Decimal
from pathlib import Path

from rest_framework import serializers

from apps.common.choices import WorklogStatus
from apps.implementation.models import (
    ImplementationChecklistItem,
    Project,
    WorkLogEvidence,
    WorkLogEntry,
)

SUPPORTED_WORKLOG_EVIDENCE_EXTENSIONS = {
    ".txt",
    ".docx",
    ".xlsx",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".heic",
    ".heif",
}


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
            "item_type",
            "implementation_task",
            "acceptance_criteria",
            "review_questions",
            "requires_document",
            "requires_evidence",
            "ai_review_focus",
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


class WorkLogEntrySerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    consultant_username = serializers.CharField(source="consultant.username", read_only=True)
    action_plan_title = serializers.CharField(source="action_plan.title", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)
    evidence_count = serializers.SerializerMethodField()

    def get_evidence_count(self, obj):
        return getattr(obj, "evidence_count", obj.evidences.count())

    class Meta:
        model = WorkLogEntry
        fields = [
            "id",
            "project",
            "project_name",
            "action_plan",
            "action_plan_title",
            "consultant",
            "consultant_username",
            "work_date",
            "activity_type",
            "title",
            "summary",
            "deliverables",
            "start_time",
            "end_time",
            "logged_hours",
            "billable_hours",
            "approved_hours",
            "status",
            "review_notes",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "created_by",
            "evidence_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "action_plan_title",
            "consultant_username",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "created_by",
            "evidence_count",
            "created_at",
            "updated_at",
        ]


class WorkLogEntryCreateSerializer(serializers.ModelSerializer):
    consultant = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = WorkLogEntry
        fields = [
            "project",
            "action_plan",
            "work_date",
            "activity_type",
            "title",
            "summary",
            "deliverables",
            "start_time",
            "end_time",
            "logged_hours",
            "billable_hours",
            "consultant",
        ]
        extra_kwargs = {
            "work_date": {"required": False},
            "logged_hours": {"required": False, "allow_null": True},
            "billable_hours": {"required": False, "allow_null": True},
            "action_plan": {"required": False},
        }

    def validate(self, attrs):
        project = attrs.get("project")
        action_plan = attrs.get("action_plan")
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        logged_hours = attrs.get("logged_hours")

        if action_plan and action_plan.project_id != project.id:
            raise serializers.ValidationError(
                {"action_plan": "Action plan does not belong to the selected project."}
            )

        if bool(start_time) ^ bool(end_time):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Provide both start_time and end_time, or leave both empty and enter logged_hours."
                    )
                }
            )

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {"end_time": "end_time must be later than start_time."}
            )

        if not start_time and not end_time and not logged_hours:
            raise serializers.ValidationError(
                {
                    "logged_hours": (
                        "Enter logged_hours if you are not providing start and end times."
                    )
                }
            )

        if logged_hours is not None and logged_hours <= Decimal("0.00"):
            raise serializers.ValidationError(
                {"logged_hours": "logged_hours must be greater than zero."}
            )

        billable_hours = attrs.get("billable_hours")
        if billable_hours is not None and billable_hours < Decimal("0.00"):
            raise serializers.ValidationError(
                {"billable_hours": "billable_hours cannot be negative."}
            )

        return attrs

    def create(self, validated_data):
        if validated_data.get("logged_hours") is None:
            validated_data["logged_hours"] = Decimal("0.00")

        if validated_data.get("billable_hours") in {None, Decimal("0.00")}:
            validated_data["billable_hours"] = validated_data.get(
                "logged_hours",
                Decimal("0.00"),
            )
        return super().create(validated_data)


class WorkLogEntryUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLogEntry
        fields = [
            "work_date",
            "activity_type",
            "title",
            "summary",
            "deliverables",
            "start_time",
            "end_time",
            "logged_hours",
            "billable_hours",
            "review_notes",
        ]


class WorkLogApprovalSerializer(serializers.Serializer):
    approved_hours = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal("0.00"),
    )
    review_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        approved_hours = attrs.get("approved_hours")
        if approved_hours is not None and approved_hours == Decimal("0.00"):
            raise serializers.ValidationError(
                {"approved_hours": "approved_hours must be greater than zero."}
            )
        return attrs


class WorkLogEvidenceSerializer(serializers.ModelSerializer):
    worklog_title = serializers.CharField(source="worklog.title", read_only=True)
    project = serializers.IntegerField(source="worklog.project_id", read_only=True)
    project_name = serializers.CharField(source="worklog.project.name", read_only=True)
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = WorkLogEvidence
        fields = [
            "id",
            "worklog",
            "worklog_title",
            "project",
            "project_name",
            "title",
            "notes",
            "file",
            "file_name",
            "file_extension",
            "uploaded_by",
            "uploaded_by_username",
            "uploaded_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "worklog_title",
            "project",
            "project_name",
            "file_name",
            "file_extension",
            "uploaded_by",
            "uploaded_by_username",
            "uploaded_at",
            "created_at",
            "updated_at",
        ]


class WorkLogEvidenceCreateSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = WorkLogEvidence
        fields = [
            "worklog",
            "title",
            "notes",
            "file",
        ]

    def validate_file(self, upload):
        suffix = Path(upload.name).suffix.lower()
        if suffix not in SUPPORTED_WORKLOG_EVIDENCE_EXTENSIONS:
            raise serializers.ValidationError(
                "Tipo de archivo no soportado. Use: .txt, .docx, .xlsx, .pdf, .png, .jpg, .jpeg, .webp, .heic, .heif"
            )
        return upload
