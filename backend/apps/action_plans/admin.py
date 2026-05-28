from django.contrib import admin

from apps.action_plans.models import ActionPlan, Evidence, ImplementationActivity


@admin.register(ActionPlan)
class ActionPlanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "title",
        "status",
        "risk_level",
        "owner",
        "due_date",
        "is_auto_generated",
    )
    list_filter = ("status", "risk_level", "is_auto_generated")
    search_fields = ("title", "description", "recommended_action", "project__name")
    autocomplete_fields = ("project", "finding", "requirement", "checklist_item", "owner")


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "title",
        "evidence_type",
        "status",
        "uploaded_at",
        "validated_at",
    )
    list_filter = ("evidence_type", "status")
    search_fields = ("title", "description", "project__name")
    autocomplete_fields = (
        "project",
        "action_plan",
        "finding",
        "requirement",
        "checklist_item",
        "document",
        "uploaded_by",
        "validated_by",
    )


@admin.register(ImplementationActivity)
class ImplementationActivityAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "action_plan",
        "activity_type",
        "title",
        "happened_on",
        "next_follow_up_on",
        "created_by",
    )
    list_filter = ("activity_type", "happened_on")
    search_fields = ("title", "notes", "project__name", "action_plan__title")
    autocomplete_fields = (
        "project",
        "action_plan",
        "requirement",
        "checklist_item",
        "created_by",
    )
