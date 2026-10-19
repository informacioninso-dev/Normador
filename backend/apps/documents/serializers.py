from apps.companies.api_access import CompanyRelationsMixin, PrivateFileMixin
from pathlib import Path

from rest_framework import serializers

from apps.common.choices import LibraryDocumentKind, LibraryUsage
from apps.documents.models import Document, DocumentChunk, DocumentProcessingJob

SUPPORTED_DOCUMENT_EXTENSIONS = {".txt", ".docx", ".xlsx", ".pdf"}
VALID_LIBRARY_USAGES = {choice.value for choice in LibraryUsage}


class ProcessingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentProcessingJob
        fields = ["id", "document", "operation", "review_after_processing", "status", "task_id", "attempts", "error", "result", "created_by", "created_at", "started_at", "finished_at"]
        read_only_fields = fields


class DocumentSerializer(PrivateFileMixin, serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.query_params.get("summary") == "true":
            for name in ("extracted_text", "extracted_metadata"):
                fields.pop(name, None)
        return fields

    project_name = serializers.CharField(source="project.name", read_only=True)
    library_standard_name = serializers.CharField(source="library_standard.name", read_only=True)
    library_company_name = serializers.CharField(source="library_company.name", read_only=True)
    library_project_name = serializers.CharField(source="library_project.name", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    checklist_item_title = serializers.CharField(source="checklist_item.title", read_only=True)
    chunk_count = serializers.SerializerMethodField()
    latest_job = serializers.SerializerMethodField()

    def get_latest_job(self, obj):
        job = obj.processing_jobs.first()
        return ProcessingJobSerializer(job).data if job else None

    def get_chunk_count(self, obj):
        return getattr(obj, "chunk_count", obj.chunks.count())

    class Meta:
        model = Document
        fields = [
            "id",
            "project",
            "project_name",
            "is_reference",
            "library_standard",
            "library_standard_name",
            "library_company",
            "library_company_name",
            "library_project",
            "library_project_name",
            "library_kind",
            "library_usages",
            "process_area",
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
            "latest_job",
            "processing_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "library_standard_name",
            "library_company_name",
            "library_project_name",
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


class DocumentWriteSerializer(CompanyRelationsMixin, serializers.ModelSerializer):
    auto_review = serializers.BooleanField(required=False, write_only=True, default=False)
    title = serializers.CharField(required=False, allow_blank=True)
    library_usages = serializers.ListField(
        child=serializers.ChoiceField(choices=LibraryUsage.choices),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Document
        fields = [
            "auto_review",
            "project",
            "is_reference",
            "library_standard",
            "library_company",
            "library_project",
            "library_kind",
            "library_usages",
            "process_area",
            "requirement",
            "checklist_item",
            "title",
            "document_type",
            "file",
        ]
        extra_kwargs = {
            "project": {"required": False, "allow_null": True},
            "library_standard": {"required": False, "allow_null": True},
            "library_company": {"required": False, "allow_null": True},
            "library_project": {"required": False, "allow_null": True},
            "library_kind": {"required": False},
            "process_area": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        is_reference = attrs.get(
            "is_reference",
            getattr(self.instance, "is_reference", False),
        )
        project = attrs.get("project", getattr(self.instance, "project", None))
        library_standard = attrs.get("library_standard", getattr(self.instance, "library_standard", None))
        library_company = attrs.get("library_company", getattr(self.instance, "library_company", None))
        library_project = attrs.get("library_project", getattr(self.instance, "library_project", None))
        library_kind = attrs.get(
            "library_kind",
            getattr(self.instance, "library_kind", LibraryDocumentKind.OTHER),
        )
        requirement = attrs.get("requirement") or getattr(self.instance, "requirement", None)
        checklist_item = attrs.get("checklist_item") or getattr(
            self.instance,
            "checklist_item",
            None,
        )
        upload = attrs.get("file")

        if not is_reference and project is None:
            raise serializers.ValidationError(
                {"project": "Se requiere un proyecto para documentos no-referencia."}
            )

        if is_reference:
            attrs["checklist_item"] = None
            attrs["project"] = None
            attrs["requirement"] = None
            request = self.context.get("request")
            if request and not request.user.is_staff and not (library_company or library_project):
                raise serializers.ValidationError({"library_company": "Solo un administrador puede publicar referencias globales. Selecciona tu empresa."})
            if library_project:
                if library_company and library_project.company_id != library_company.id:
                    raise serializers.ValidationError(
                        {
                            "library_project": (
                                "El proyecto no pertenece a la empresa vinculada."
                            )
                        }
                    )
                if library_standard and library_project.standard_id != library_standard.id:
                    raise serializers.ValidationError(
                        {
                            "library_project": (
                                "El proyecto no pertenece a la norma vinculada."
                            )
                        }
                    )
                attrs["library_company"] = library_company or library_project.company
                attrs["library_standard"] = library_standard or library_project.standard
            if library_kind == LibraryDocumentKind.COMPANY_CONTEXT and not (
                library_company or library_project
            ):
                raise serializers.ValidationError(
                    {
                        "library_company": (
                            "El contexto de empresa debe vincularse a una empresa o proyecto."
                        )
                    }
                )
            if not attrs.get("library_usages"):
                attrs["library_usages"] = _default_library_usages(library_kind)
            attrs["library_usages"] = _normalize_library_usages(attrs["library_usages"])
        else:
            attrs["library_standard"] = None
            attrs["library_company"] = None
            attrs["library_project"] = None
            attrs["library_kind"] = LibraryDocumentKind.OTHER
            attrs["library_usages"] = []
            attrs["process_area"] = ""

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


def _default_library_usages(library_kind: str) -> list[str]:
    if library_kind in {LibraryDocumentKind.STANDARD_SOURCE, LibraryDocumentKind.ANNEX}:
        return [
            LibraryUsage.CHECKLIST,
            LibraryUsage.REVIEW_CONTEXT,
            LibraryUsage.RAG_CONTEXT,
        ]
    if library_kind == LibraryDocumentKind.COMPANY_CONTEXT:
        return [LibraryUsage.REVIEW_CONTEXT, LibraryUsage.RAG_CONTEXT]
    if library_kind == LibraryDocumentKind.TEMPLATE:
        return [LibraryUsage.TEMPLATE, LibraryUsage.REVIEW_CONTEXT]
    return [LibraryUsage.GENERAL]


def _normalize_library_usages(usages) -> list[str]:
    if usages is None:
        return []
    if isinstance(usages, str):
        usages = [usages]
    normalized = []
    for usage in usages:
        value = str(usage).strip()
        if not value:
            continue
        if value not in VALID_LIBRARY_USAGES:
            raise serializers.ValidationError(
                {"library_usages": f"Uso de biblioteca no valido: {value}."}
            )
        normalized.append(value)
    return list(dict.fromkeys(normalized))


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
