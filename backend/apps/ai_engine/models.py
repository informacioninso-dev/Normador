from django.conf import settings
from django.db import models

from apps.common.choices import AILogStatus, AIOperationType, AIProvider
from apps.common.models import TimeStampedModel


class PromptTemplate(TimeStampedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    provider = models.CharField(
        max_length=32,
        choices=AIProvider.choices,
        default=AIProvider.OLLAMA,
    )
    purpose = models.CharField(max_length=128)
    version = models.CharField(max_length=32, default="v1")
    system_prompt = models.TextField()
    response_schema = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "-created_at"]

    def __str__(self):
        return f"{self.name} ({self.version})"


class AIProviderLog(TimeStampedModel):
    provider = models.CharField(
        max_length=32,
        choices=AIProvider.choices,
        default=AIProvider.OLLAMA,
    )
    model_name = models.CharField(max_length=255)
    operation_type = models.CharField(
        max_length=32,
        choices=AIOperationType.choices,
        default=AIOperationType.REVIEW,
    )
    status = models.CharField(
        max_length=32,
        choices=AILogStatus.choices,
        default=AILogStatus.SUCCESS,
    )
    prompt_version = models.CharField(max_length=32, blank=True)
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_provider_logs",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider}:{self.model_name} ({self.operation_type})"
