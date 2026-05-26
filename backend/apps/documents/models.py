from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.common.choices import (
    AIProvider,
    DocumentProcessingStatus,
    DocumentType,
    EmbeddingStatus,
)
from apps.common.models import TimeStampedModel


def document_upload_to(instance, filename: str) -> str:
    original = Path(filename)
    extension = original.suffix.lower()
    base_name = slugify(original.stem) or "document"
    period = timezone.now().strftime("%Y/%m")
    project_segment = f"project_{instance.project_id or 'unassigned'}"
    return f"documents/{project_segment}/{period}/{base_name}{extension}"


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
