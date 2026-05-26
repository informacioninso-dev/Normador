from django.contrib import admin

from apps.reviews.models import DocumentReview, Finding, RequirementEvaluation


@admin.register(DocumentReview)
class DocumentReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "document",
        "review_type",
        "overall_status",
        "risk_level",
        "ai_model_used",
        "created_at",
    )
    list_filter = ("review_type", "overall_status", "risk_level")
    search_fields = ("document__title", "project__name", "summary", "ai_model_used")


@admin.register(RequirementEvaluation)
class RequirementEvaluationAdmin(admin.ModelAdmin):
    list_display = (
        "document_review",
        "requirement",
        "status",
        "risk_level",
        "can_close_requirement",
    )
    list_filter = ("status", "risk_level", "can_close_requirement")
    search_fields = ("requirement__title", "recommendation", "gap")


@admin.register(Finding)
class FindingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "finding_type",
        "risk_level",
        "status",
        "created_at",
    )
    list_filter = ("finding_type", "risk_level", "status")
    search_fields = ("description", "recommended_action", "project__name")
