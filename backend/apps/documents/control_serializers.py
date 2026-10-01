import re

from rest_framework import serializers

from apps.common.choices import ControlledDocumentKind
from apps.documents.generator import validate_content
from apps.documents.models import ControlledDocument, DocumentControlEvent, DocumentRevision
from apps.implementation.models import ImplementationChecklistItem, Project
from apps.standards.models import StandardRequirement


class DocumentRevisionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)
    extracted_text = serializers.SerializerMethodField()

    def get_extracted_text(self, obj):
        return obj.document.extracted_text[:10000] if obj.source == "ARCHIVO" else ""

    class Meta:
        model = DocumentRevision
        fields = [
            "id", "document", "number", "status", "content", "source", "content_hash",
            "released_hash", "change_summary", "created_by_username", "approved_by_username",
            "approved_at", "effective_date", "approval_notes", "created_at", "extracted_text",
        ]


class DocumentControlEventSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    revision_number = serializers.IntegerField(source="revision.number", read_only=True)

    class Meta:
        model = DocumentControlEvent
        fields = ["id", "action", "notes", "username", "revision_number", "created_at"]


class ControlledDocumentSerializer(serializers.ModelSerializer):
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    clause = serializers.CharField(source="requirement.clause", read_only=True)
    latest_revision = serializers.SerializerMethodField()
    current_revision = serializers.SerializerMethodField()
    revisions = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    def get_latest_revision(self, obj):
        revisions = list(obj.revisions.all())
        return DocumentRevisionSerializer(revisions[0]).data if revisions else None

    def get_current_revision(self, obj):
        revision = next((r for r in obj.revisions.all() if r.status == "VIGENTE"), None)
        return DocumentRevisionSerializer(revision).data if revision else None

    def get_revisions(self, obj):
        if not self.context.get("detail"):
            return []
        return DocumentRevisionSerializer(obj.revisions.all(), many=True).data

    def get_events(self, obj):
        if not self.context.get("detail"):
            return []
        return DocumentControlEventSerializer(obj.control_events.all(), many=True).data

    class Meta:
        model = ControlledDocument
        fields = [
            "id", "project", "code", "title", "kind", "process_area", "requirement",
            "requirement_title", "clause", "checklist_item", "archived_at", "created_at",
            "latest_revision", "current_revision", "revisions", "events",
        ]


class ControlledDocumentCreateSerializer(serializers.Serializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.select_related("company", "standard"))
    code = serializers.CharField(max_length=64)
    title = serializers.CharField(max_length=255)
    kind = serializers.ChoiceField(choices=ControlledDocumentKind.choices)
    process_area = serializers.CharField(max_length=120, required=False, allow_blank=True)
    requirement = serializers.PrimaryKeyRelatedField(
        queryset=StandardRequirement.objects.all(), required=False, allow_null=True,
    )
    checklist_item = serializers.PrimaryKeyRelatedField(
        queryset=ImplementationChecklistItem.objects.select_related("requirement"), required=False, allow_null=True,
    )
    content = serializers.JSONField(required=False)

    def validate_code(self, value):
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{1,63}", value):
            raise serializers.ValidationError("Usa de 2 a 64 letras, numeros, puntos, guiones o guiones bajos.")
        return value

    def validate(self, attrs):
        project, user = attrs["project"], self.context["request"].user
        if not user.is_staff and project.company.created_by_id != user.id:
            raise serializers.ValidationError({"project": "No tienes acceso a este proyecto."})
        requirement, item = attrs.get("requirement"), attrs.get("checklist_item")
        if requirement and requirement.standard_id != project.standard_id:
            raise serializers.ValidationError({"requirement": "El requisito no pertenece a la norma del proyecto."})
        if item and (item.project_id != project.id or (requirement and item.requirement_id != requirement.id)):
            raise serializers.ValidationError({"checklist_item": "El item no corresponde al proyecto y requisito."})
        if "content" in attrs:
            try:
                attrs["content"] = validate_content(attrs["kind"], attrs["content"])
            except ValueError as exc:
                raise serializers.ValidationError({"content": str(exc)}) from exc
        return attrs


class NewDocumentRevisionSerializer(serializers.Serializer):
    expected_version = serializers.IntegerField(min_value=1)
    change_summary = serializers.CharField(max_length=3000)
    content = serializers.JSONField(required=False)
    file = serializers.FileField(required=False)

    def validate(self, attrs):
        if "content" not in attrs and "file" not in attrs:
            raise serializers.ValidationError("Incluye el contenido editado o un archivo corregido.")
        if "content" in attrs and "file" in attrs:
            raise serializers.ValidationError("Selecciona contenido editado o archivo, uno por version.")
        return attrs


class DocumentControlTransitionSerializer(serializers.Serializer):
    expected_version = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=["submit", "return_to_draft", "approve", "archive"])
    notes = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    confirmed = serializers.BooleanField(default=False)
