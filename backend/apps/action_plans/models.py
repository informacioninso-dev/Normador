from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.common.choices import (
    ActionPlanStatus,
    EvidenceType,
    EvidenceValidationStatus,
    ImplementationActivityType,
    RiskLevel,
)
from apps.common.models import TimeStampedModel


def evidence_upload_to(instance, filename: str) -> str:
    original = Path(filename)
    extension = original.suffix.lower()
    base_name = slugify(original.stem) or "evidence"
    period = timezone.now().strftime("%Y/%m")
    project_segment = f"project_{instance.project_id or 'unassigned'}"
    return f"evidence/{project_segment}/{period}/{base_name}{extension}"


class ActionPlan(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project",
        on_delete=models.CASCADE,
        related_name="action_plans",
    )
    finding = models.ForeignKey(
        "reviews.Finding",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="action_plans",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="action_plans",
    )
    checklist_item = models.ForeignKey(
        "implementation.ImplementationChecklistItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="action_plans",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    recommended_action = models.TextField(blank=True)
    risk_level = models.CharField(
        max_length=8,
        choices=RiskLevel.choices,
        default=RiskLevel.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=ActionPlanStatus.choices,
        default=ActionPlanStatus.PENDING,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_action_plans",
    )
    due_date = models.DateField(null=True, blank=True)
    completion_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_auto_generated = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_action_plans",
    )

    class Meta:
        ordering = ["status", "due_date", "-created_at", "-id"]

    def __str__(self):
        return self.title


class ImplementationActivity(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project",
        on_delete=models.CASCADE,
        related_name="implementation_activities",
    )
    action_plan = models.ForeignKey(
        ActionPlan,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="activities",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="implementation_activities",
    )
    checklist_item = models.ForeignKey(
        "implementation.ImplementationChecklistItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="implementation_activities",
    )
    activity_type = models.CharField(
        max_length=24,
        choices=ImplementationActivityType.choices,
        default=ImplementationActivityType.FOLLOW_UP,
    )
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    happened_on = models.DateField(default=timezone.localdate)
    next_follow_up_on = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="implementation_activities",
    )

    class Meta:
        ordering = ["-happened_on", "-created_at", "-id"]

    def __str__(self):
        return self.title


class Evidence(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project",
        on_delete=models.CASCADE,
        related_name="evidences",
    )
    action_plan = models.ForeignKey(
        ActionPlan,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidences",
    )
    finding = models.ForeignKey(
        "reviews.Finding",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidences",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidences",
    )
    checklist_item = models.ForeignKey(
        "implementation.ImplementationChecklistItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidences",
    )
    document = models.ForeignKey(
        "documents.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supporting_evidences",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    evidence_type = models.CharField(
        max_length=32,
        choices=EvidenceType.choices,
        default=EvidenceType.OTHER,
    )
    file = models.FileField(
        upload_to=evidence_upload_to,
        max_length=500,
        blank=True,
    )
    file_name = models.CharField(max_length=255, blank=True)
    file_extension = models.CharField(max_length=16, blank=True)
    status = models.CharField(
        max_length=16,
        choices=EvidenceValidationStatus.choices,
        default=EvidenceValidationStatus.UPLOADED,
    )
    occurred_on = models.DateField(null=True, blank=True)
    validation_notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_evidences",
    )
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="validated_evidences",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            self.file_name = Path(self.file.name).name
        if self.file and not self.file_extension:
            self.file_extension = Path(self.file.name).suffix.lower()
        if not self.title:
            if self.file_name:
                self.title = Path(self.file_name).stem
            elif self.document_id:
                self.title = self.document.title
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
