from django.conf import settings
from django.db import models

from apps.common.choices import (
    FindingStatus,
    FindingType,
    RequirementEvaluationStatus,
    ReviewType,
    RiskLevel,
)
from apps.common.models import TimeStampedModel


class DocumentReview(TimeStampedModel):
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    project = models.ForeignKey(
        "implementation.Project",
        on_delete=models.CASCADE,
        related_name="document_reviews",
    )
    standard = models.ForeignKey(
        "standards.Standard",
        on_delete=models.PROTECT,
        related_name="document_reviews",
    )
    review_type = models.CharField(
        max_length=32,
        choices=ReviewType.choices,
        default=ReviewType.DOCUMENT_REVIEW,
    )
    overall_status = models.CharField(
        max_length=24,
        choices=RequirementEvaluationStatus.choices,
        default=RequirementEvaluationStatus.NOT_EVALUATED,
    )
    risk_level = models.CharField(
        max_length=8,
        choices=RiskLevel.choices,
        default=RiskLevel.MEDIUM,
    )
    summary = models.TextField(blank=True)
    prompt_version = models.CharField(max_length=64, blank=True)
    system_prompt_used = models.TextField(blank=True)
    user_prompt_used = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    retrieved_context = models.JSONField(default=dict, blank=True)
    ai_model_used = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="document_reviews",
    )

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Review #{self.id} - {self.document.title}"


class RequirementEvaluation(TimeStampedModel):
    document_review = models.ForeignKey(
        DocumentReview,
        on_delete=models.CASCADE,
        related_name="requirement_evaluations",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        on_delete=models.CASCADE,
        related_name="requirement_evaluations",
    )
    status = models.CharField(
        max_length=24,
        choices=RequirementEvaluationStatus.choices,
        default=RequirementEvaluationStatus.NOT_EVALUATED,
    )
    evidence_found = models.TextField(blank=True)
    gap = models.TextField(blank=True)
    risk_level = models.CharField(
        max_length=8,
        choices=RiskLevel.choices,
        default=RiskLevel.MEDIUM,
    )
    recommendation = models.TextField(blank=True)
    suggested_text = models.TextField(blank=True)
    can_close_requirement = models.BooleanField(default=False)
    requires_real_evidence = models.BooleanField(default=True)
    missing_documents_or_evidence = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["requirement__sequence", "requirement__clause", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["document_review", "requirement"],
                name="unique_requirement_evaluation_per_review_requirement",
            )
        ]

    def __str__(self):
        return f"{self.document_review_id}:{self.requirement.clause}"


class Finding(TimeStampedModel):
    project = models.ForeignKey(
        "implementation.Project",
        on_delete=models.CASCADE,
        related_name="findings",
    )
    document_review = models.ForeignKey(
        DocumentReview,
        on_delete=models.CASCADE,
        related_name="findings",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="findings",
    )
    finding_type = models.CharField(
        max_length=32,
        choices=FindingType.choices,
        default=FindingType.DOCUMENTARY_GAP,
    )
    description = models.TextField()
    risk_level = models.CharField(
        max_length=8,
        choices=RiskLevel.choices,
        default=RiskLevel.MEDIUM,
    )
    root_cause_suggestion = models.TextField(blank=True)
    recommended_action = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=FindingStatus.choices,
        default=FindingStatus.OPEN,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.finding_type} - {self.project.name}"
