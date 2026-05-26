from pathlib import Path

from rest_framework import serializers

from apps.documents.models import Document, DocumentChunk

SUPPORTED_DOCUMENT_EXTENSIONS = {".txt", ".docx", ".xlsx", ".pdf"}


class DocumentSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    checklist_item_title = serializers.CharField(source="checklist_item.title", read_only=True)
    chunk_count = serializers.SerializerMethodField()

    def get_chunk_count(self, obj):
        return getattr(obj, "chunk_count", obj.chunks.count())

    class Meta:
        model = Document
        fields = [
            "id",
            "project",
            "project_name",
            "is_reference",
            "requirement",
            "requirement_title",
            "checklist_item",
            "checklist_item_title",
            "title",
            "document_type",
            "file",
            "file_name",
            "file_extension",
            "status",
            "uploaded_by",
            "uploaded_at",
            "extracted_text",
            "extracted_metadata",
            "chunk_count",
            "processing_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "requirement_title",
            "checklist_item_title",
            "file_name",
            "file_extension",
            "status",
            "uploaded_by",
            "uploaded_at",
            "extracted_text",
            "extracted_metadata",
            "chunk_count",
            "processing_error",
            "created_at",
            "updated_at",
        ]


class DocumentWriteSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Document
        fields = [
            "project",
            "is_reference",
            "requirement",
            "checklist_item",
            "title",
            "document_type",
            "file",
        ]
        extra_kwargs = {
            "project": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        is_reference = attrs.get(
            "is_reference",
            getattr(self.instance, "is_reference", False),
        )
        project = attrs.get("project") or getattr(self.instance, "project", None)
        requirement = attrs.get("requirement") or getattr(self.instance, "requirement", None)
        checklist_item = attrs.get("checklist_item") or getattr(
            self.instance,
            "checklist_item",
            None,
        )
        upload = attrs.get("file")

        if not is_reference and project is None and self.instance is None:
            raise serializers.ValidationError(
                {"project": "Se requiere un proyecto para documentos no-referencia."}
            )

        if is_reference:
            attrs.pop("checklist_item", None)
            attrs["project"] = None

        if upload:
            suffix = Path(upload.name).suffix.lower()
            if suffix not in SUPPORTED_DOCUMENT_EXTENSIONS:
                raise serializers.ValidationError(
                    {
                        "file": (
                            "Tipo de archivo no soportado. Use: "
                            ".txt, .docx, .xlsx, .pdf"
                        )
                    }
                )

        if checklist_item and project and checklist_item.project_id != project.id:
            raise serializers.ValidationError(
                {"checklist_item": "El checklist item no pertenece al proyecto seleccionado."}
            )

        if requirement and project and requirement.standard_id != project.standard_id:
            raise serializers.ValidationError(
                {"requirement": "El requisito no pertenece a la norma del proyecto."}
            )

        if checklist_item and requirement and checklist_item.requirement_id != requirement.id:
            raise serializers.ValidationError(
                {
                    "checklist_item": (
                        "El checklist item no corresponde al requisito seleccionado."
                    )
                }
            )

        if checklist_item and not requirement:
            attrs["requirement"] = checklist_item.requirement

        return attrs

    def create(self, validated_data):
        upload = validated_data.get("file")
        if upload and not validated_data.get("title"):
            validated_data["title"] = Path(upload.name).stem
        return super().create(validated_data)


class DocumentChunkSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    project = serializers.IntegerField(source="document.project_id", read_only=True)
    project_name = serializers.CharField(source="document.project.name", read_only=True)
    document_type = serializers.CharField(source="document.document_type", read_only=True)
    similarity_score = serializers.SerializerMethodField()

    def get_similarity_score(self, obj):
        return getattr(obj, "similarity_score", None)

    class Meta:
        model = DocumentChunk
        fields = [
            "id",
            "document",
            "document_title",
            "project",
            "project_name",
            "document_type",
            "chunk_index",
            "content",
            "word_count",
            "character_start",
            "character_end",
            "page_number",
            "metadata",
            "embedding_dimensions",
            "embedding_provider",
            "embedding_model",
            "embedding_status",
            "embedding_error",
            "similarity_score",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
