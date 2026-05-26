from pathlib import Path

from rest_framework import serializers

from apps.action_plans.models import ActionPlan, Evidence

SUPPORTED_EVIDENCE_EXTENSIONS = {
    ".txt",
    ".docx",
    ".xlsx",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
}


class ActionPlanSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    clause = serializers.CharField(source="requirement.clause", read_only=True)
    checklist_item_title = serializers.CharField(source="checklist_item.title", read_only=True)
    finding_type = serializers.CharField(source="finding.finding_type", read_only=True)
    evidence_count = serializers.SerializerMethodField()
    validated_evidence_count = serializers.SerializerMethodField()

    def get_evidence_count(self, obj):
        return getattr(obj, "evidence_count", obj.evidences.count())

    def get_validated_evidence_count(self, obj):
        validated = obj.evidences.filter(status="VALIDADA")
        return getattr(obj, "validated_evidence_count", validated.count())

    class Meta:
        model = ActionPlan
        fields = [
            "id",
            "project",
            "project_name",
            "finding",
            "finding_type",
            "requirement",
            "requirement_title",
            "clause",
            "checklist_item",
            "checklist_item_title",
            "title",
            "description",
            "recommended_action",
            "risk_level",
            "status",
            "owner",
            "due_date",
            "completion_notes",
            "resolved_at",
            "closed_at",
            "is_auto_generated",
            "created_by",
            "evidence_count",
            "validated_evidence_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "finding_type",
            "requirement_title",
            "clause",
            "checklist_item_title",
            "status",
            "resolved_at",
            "closed_at",
            "is_auto_generated",
            "created_by",
            "evidence_count",
            "validated_evidence_count",
            "created_at",
            "updated_at",
        ]


class ActionPlanCreateSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    recommended_action = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = ActionPlan
        fields = [
            "project",
            "finding",
            "requirement",
            "checklist_item",
            "title",
            "description",
            "recommended_action",
            "risk_level",
            "owner",
            "due_date",
        ]
        extra_kwargs = {
            "project": {"required": False},
            "finding": {"required": False},
            "requirement": {"required": False},
            "checklist_item": {"required": False},
        }

    def validate(self, attrs):
        project = attrs.get("project")
        finding = attrs.get("finding")
        requirement = attrs.get("requirement")
        checklist_item = attrs.get("checklist_item")

        if finding:
            if project and finding.project_id != project.id:
                raise serializers.ValidationError(
                    {"finding": "Finding does not belong to the selected project."}
                )
            project = project or finding.project
            requirement = requirement or finding.requirement
            if checklist_item is None and finding.requirement_id:
                checklist_item = finding.project.checklist_items.filter(
                    requirement_id=finding.requirement_id
                ).first()

        if checklist_item and project and checklist_item.project_id != project.id:
            raise serializers.ValidationError(
                {"checklist_item": "Checklist item does not belong to the selected project."}
            )

        if requirement and project and requirement.standard_id != project.standard_id:
            raise serializers.ValidationError(
                {"requirement": "Requirement does not belong to the project's standard."}
            )

        if checklist_item and requirement and checklist_item.requirement_id != requirement.id:
            raise serializers.ValidationError(
                {
                    "checklist_item": (
                        "Checklist item does not match the selected requirement."
                    )
                }
            )

        attrs["project"] = project
        if requirement:
            attrs["requirement"] = requirement
        if checklist_item:
            attrs["checklist_item"] = checklist_item
        return attrs

    def create(self, validated_data):
        finding = validated_data.get("finding")
        if finding and not validated_data.get("title"):
            requirement = validated_data.get("requirement")
            suffix = requirement.clause if requirement else f"hallazgo-{finding.id}"
            validated_data["title"] = f"Plan de accion {suffix}"
        if finding and not validated_data.get("description"):
            validated_data["description"] = finding.description
        if finding and not validated_data.get("recommended_action"):
            validated_data["recommended_action"] = finding.recommended_action
        return super().create(validated_data)


class ActionPlanUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionPlan
        fields = [
            "title",
            "description",
            "recommended_action",
            "risk_level",
            "owner",
            "due_date",
            "completion_notes",
        ]


class ActionPlanTransitionSerializer(serializers.Serializer):
    completion_notes = serializers.CharField(required=False, allow_blank=True)


class EvidenceSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    action_plan_title = serializers.CharField(source="action_plan.title", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    clause = serializers.CharField(source="requirement.clause", read_only=True)
    checklist_item_title = serializers.CharField(source="checklist_item.title", read_only=True)
    document_title = serializers.CharField(source="document.title", read_only=True)

    class Meta:
        model = Evidence
        fields = [
            "id",
            "project",
            "project_name",
            "action_plan",
            "action_plan_title",
            "finding",
            "requirement",
            "requirement_title",
            "clause",
            "checklist_item",
            "checklist_item_title",
            "document",
            "document_title",
            "title",
            "description",
            "evidence_type",
            "file",
            "file_name",
            "file_extension",
            "status",
            "occurred_on",
            "validation_notes",
            "uploaded_by",
            "validated_by",
            "uploaded_at",
            "validated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "action_plan_title",
            "requirement_title",
            "clause",
            "checklist_item_title",
            "document_title",
            "file_name",
            "file_extension",
            "status",
            "validation_notes",
            "uploaded_by",
            "validated_by",
            "uploaded_at",
            "validated_at",
            "created_at",
            "updated_at",
        ]


class EvidenceCreateSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Evidence
        fields = [
            "project",
            "action_plan",
            "finding",
            "requirement",
            "checklist_item",
            "document",
            "title",
            "description",
            "evidence_type",
            "file",
            "occurred_on",
        ]
        extra_kwargs = {
            "project": {"required": False},
            "action_plan": {"required": False},
            "finding": {"required": False},
            "requirement": {"required": False},
            "checklist_item": {"required": False},
            "document": {"required": False},
            "file": {"required": False},
        }

    def validate(self, attrs):
        project = attrs.get("project")
        action_plan = attrs.get("action_plan")
        finding = attrs.get("finding")
        requirement = attrs.get("requirement")
        checklist_item = attrs.get("checklist_item")
        document = attrs.get("document")
        upload = attrs.get("file")
        description = attrs.get("description", "")

        if upload:
            suffix = Path(upload.name).suffix.lower()
            if suffix not in SUPPORTED_EVIDENCE_EXTENSIONS:
                raise serializers.ValidationError(
                    {
                        "file": (
                            "Unsupported evidence file type. Use one of: "
                            ".txt, .docx, .xlsx, .pdf, .png, .jpg, .jpeg"
                        )
                    }
                )

        if action_plan:
            if project and action_plan.project_id != project.id:
                raise serializers.ValidationError(
                    {"action_plan": "Action plan does not belong to the selected project."}
                )
            project = project or action_plan.project
            requirement = requirement or action_plan.requirement
            checklist_item = checklist_item or action_plan.checklist_item
            finding = finding or action_plan.finding

        if finding:
            if project and finding.project_id != project.id:
                raise serializers.ValidationError(
                    {"finding": "Finding does not belong to the selected project."}
                )
            project = project or finding.project
            requirement = requirement or finding.requirement
            if checklist_item is None and finding.requirement_id:
                checklist_item = finding.project.checklist_items.filter(
                    requirement_id=finding.requirement_id
                ).first()

        if document:
            if project and document.project_id != project.id:
                raise serializers.ValidationError(
                    {"document": "Document does not belong to the selected project."}
                )
            project = project or document.project
            requirement = requirement or document.requirement
            checklist_item = checklist_item or document.checklist_item

        if checklist_item and project and checklist_item.project_id != project.id:
            raise serializers.ValidationError(
                {"checklist_item": "Checklist item does not belong to the selected project."}
            )

        if requirement and project and requirement.standard_id != project.standard_id:
            raise serializers.ValidationError(
                {"requirement": "Requirement does not belong to the project's standard."}
            )

        if checklist_item and requirement and checklist_item.requirement_id != requirement.id:
            raise serializers.ValidationError(
                {
                    "checklist_item": (
                        "Checklist item does not match the selected requirement."
                    )
                }
            )

        if not any([upload, document, description.strip()]):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Provide at least a file, a linked document, or a description."
                    )
                }
            )

        attrs["project"] = project
        if finding:
            attrs["finding"] = finding
        if requirement:
            attrs["requirement"] = requirement
        if checklist_item:
            attrs["checklist_item"] = checklist_item
        return attrs

    def create(self, validated_data):
        if not validated_data.get("title"):
            if validated_data.get("file"):
                validated_data["title"] = Path(validated_data["file"].name).stem
            elif validated_data.get("document"):
                validated_data["title"] = validated_data["document"].title
            elif validated_data.get("action_plan"):
                validated_data["title"] = f"Evidencia {validated_data['action_plan'].title}"
            else:
                validated_data["title"] = "Evidencia"
        return super().create(validated_data)


class EvidenceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = [
            "title",
            "description",
            "occurred_on",
        ]


class EvidenceValidationSerializer(serializers.Serializer):
    validation_notes = serializers.CharField(required=False, allow_blank=True)
