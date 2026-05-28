from django.contrib import admin

from apps.implementation.models import ImplementationChecklistItem, Project, WorkLogEntry


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


@admin.register(WorkLogEntry)
class WorkLogEntryAdmin(admin.ModelAdmin):
    list_display = (
        "work_date",
        "project",
        "consultant",
        "activity_type",
        "logged_hours",
        "billable_hours",
        "approved_hours",
        "status",
    )
    list_filter = ("status", "activity_type", "work_date")
    search_fields = ("title", "summary", "project__name", "consultant__username")
    autocomplete_fields = ("project", "action_plan", "consultant", "approved_by", "created_by")
