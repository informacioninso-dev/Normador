from django.contrib import admin
from apps.common.admin import BusinessRecordAdmin

from apps.documents.models import Document, DocumentChunk, DocumentProcessingJob

admin.site.register(DocumentProcessingJob, BusinessRecordAdmin)


@admin.register(Document)
class DocumentAdmin(BusinessRecordAdmin):
    list_display = (
        "title",
        "project",
        "document_type",
        "status",
        "file_extension",
        "uploaded_at",
    )
    list_filter = ("document_type", "status", "file_extension")
    search_fields = ("title", "file_name", "project__name")


@admin.register(DocumentChunk)
class DocumentChunkAdmin(BusinessRecordAdmin):
    list_display = (
        "document",
        "chunk_index",
        "word_count",
        "embedding_status",
        "embedding_dimensions",
        "embedding_provider",
    )
    list_filter = ("embedding_status", "embedding_provider")
    search_fields = ("document__title", "content")
