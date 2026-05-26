from django.contrib import admin

from apps.ai_engine.models import AIProviderLog, PromptTemplate


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "provider", "purpose", "version", "is_active")
    list_filter = ("provider", "purpose", "is_active")
    search_fields = ("name", "slug", "purpose")


@admin.register(AIProviderLog)
class AIProviderLogAdmin(admin.ModelAdmin):
    list_display = ("provider", "model_name", "operation_type", "status", "latency_ms", "created_at")
    list_filter = ("provider", "operation_type", "status")
    search_fields = ("model_name", "prompt_version", "error_message")
