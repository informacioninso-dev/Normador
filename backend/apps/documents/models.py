from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.common.choices import (
    AIProvider,
    ControlledDocumentKind,
    DocumentProcessingStatus,
    DocumentRevisionStatus,
    DocumentType,
    EmbeddingStatus,
    LibraryDocumentKind,
    LibraryUsage,
)
from apps.common.models import TimeStampedModel


def document_upload_to(instance, filename: str) -> str:
    original = Path(filename)
    extension = original.suffix.lower()
    base_name = slugify(original.stem) or "document"
    period = timezone.now().strftime("%Y/%m")
    project_segment = f"project_{instance.project_id or 'unassigned'}"
    return f"documents/{project_segment}/{period}/{base_name}{extension}"


def revision_release_upload_to(instance, filename: str) -> str:
    original = Path(filename)
    base_name = slugify(original.stem) or "document"
    return f"documents/releases/{instance.controlled_document_id}/{base_name}{original.suffix.lower()}"


class Document(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    is_reference = models.BooleanField(
        default=False,
        help_text="True para documentos de la biblioteca de referencia global.",
    )
    library_standard = models.ForeignKey(
        "standards.Standard",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="library_documents",
    )
    library_company = models.ForeignKey(
        "companies.Company",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="library_documents",
    )
    library_project = models.ForeignKey(
        "implementation.Project",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="library_documents",
    )
    library_kind = models.CharField(
        max_length=32,
        choices=LibraryDocumentKind.choices,
        default=LibraryDocumentKind.OTHER,
    )
    library_usages = models.JSONField(
        default=list,
        blank=True,
        help_text="Usos permitidos: checklist, revision, RAG, plantilla o general.",
    )
    process_area = models.CharField(max_length=120, blank=True)
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    checklist_item = models.ForeignKey(
        "implementation.ImplementationChecklistItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    title = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=32,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )
    file = models.FileField(upload_to=document_upload_to, max_length=500)
    file_name = models.CharField(max_length=255, blank=True)
    file_extension = models.CharField(max_length=16, blank=True)
    status = models.CharField(
        max_length=16,
        choices=DocumentProcessingStatus.choices,
        default=DocumentProcessingStatus.UPLOADED,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_documents",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    extracted_text = models.TextField(blank=True)
    extracted_metadata = models.JSONField(default=dict, blank=True)
    processing_error = models.TextField(blank=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            self.file_name = Path(self.file.name).name
        if self.file and not self.file_extension:
            self.file_extension = Path(self.file.name).suffix.lower()
        if not self.title and self.file_name:
            self.title = Path(self.file_name).stem
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class DocumentChunk(TimeStampedModel):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = models.PositiveIntegerField()
    content = models.TextField()
    content_hash = models.CharField(max_length=64)
    word_count = models.PositiveIntegerField(default=0)
    character_start = models.PositiveIntegerField(default=0)
    character_end = models.PositiveIntegerField(default=0)
    page_number = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    embedding = models.JSONField(default=list, blank=True)
    embedding_dimensions = models.PositiveIntegerField(default=0)
    embedding_provider = models.CharField(
        max_length=32,
        choices=AIProvider.choices,
        default=AIProvider.OLLAMA,
    )
    embedding_model = models.CharField(max_length=255, blank=True)
    embedding_status = models.CharField(
        max_length=16,
        choices=EmbeddingStatus.choices,
        default=EmbeddingStatus.PENDING,
    )
    embedding_error = models.TextField(blank=True)

    class Meta:
        ordering = ["document_id", "chunk_index", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "chunk_index"],
                name="unique_chunk_index_per_document",
            )
        ]

    def __str__(self):
        return f"{self.document_id}:{self.chunk_index}"


class ControlledDocument(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project", on_delete=models.PROTECT, related_name="controlled_documents"
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement", on_delete=models.PROTECT,
        related_name="controlled_documents", null=True, blank=True,
    )
    checklist_item = models.ForeignKey(
        "implementation.ImplementationChecklistItem", on_delete=models.PROTECT,
        related_name="controlled_documents", null=True, blank=True,
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=ControlledDocumentKind.choices)
    process_area = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_controlled_documents",
    )
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["code", "id"]
        constraints = [models.UniqueConstraint(
            fields=["project", "code"], name="unique_controlled_document_code_per_project"
        )]

    def __str__(self):
        return f"{self.code} - {self.title}"


class DocumentRevision(TimeStampedModel):
    controlled_document = models.ForeignKey(
        ControlledDocument, on_delete=models.PROTECT, related_name="revisions"
    )
    document = models.OneToOneField(
        Document, on_delete=models.PROTECT, related_name="control_revision"
    )
    number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16, choices=DocumentRevisionStatus.choices,
        default=DocumentRevisionStatus.DRAFT,
    )
    content = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=16, default="PLANTILLA")
    content_hash = models.CharField(max_length=64)
    change_summary = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_document_revisions",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_document_revisions",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    released_file = models.FileField(upload_to=revision_release_upload_to, max_length=500, blank=True)
    released_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-number", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["controlled_document", "number"], name="unique_controlled_document_revision"
            ),
            models.UniqueConstraint(
                fields=["controlled_document"], condition=models.Q(status="VIGENTE"),
                name="unique_current_controlled_document_revision",
            ),
        ]


class DocumentControlEvent(models.Model):
    controlled_document = models.ForeignKey(
        ControlledDocument, on_delete=models.PROTECT, related_name="control_events"
    )
    revision = models.ForeignKey(DocumentRevision, on_delete=models.PROTECT, related_name="control_events")
    action = models.CharField(max_length=32)
    notes = models.TextField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
