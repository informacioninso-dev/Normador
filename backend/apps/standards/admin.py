from django.contrib import admin

from apps.standards.models import Standard, StandardRequirement


@admin.register(Standard)
class StandardAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "version", "country", "is_active")
    list_filter = ("is_active", "country")
    search_fields = ("name", "code")


@admin.register(StandardRequirement)
class StandardRequirementAdmin(admin.ModelAdmin):
    list_display = (
        "standard",
        "clause",
        "title",
        "process_area",
        "criticality",
        "requires_real_evidence",
    )
    list_filter = ("standard", "process_area", "criticality", "requires_real_evidence")
    search_fields = ("title", "clause", "requirement_text")
