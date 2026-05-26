from django.contrib import admin

from apps.implementation.models import ImplementationChecklistItem, Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "standard", "status", "start_date", "target_date")
    list_filter = ("status", "standard")
    search_fields = ("name", "company__name", "standard__name")


@admin.register(ImplementationChecklistItem)
class ImplementationChecklistItemAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "status",
        "progress_percentage",
        "required_document_type",
        "required_evidence_type",
    )
    list_filter = ("status", "required_document_type", "required_evidence_type")
    search_fields = ("title", "project__name", "requirement__title", "requirement__clause")
