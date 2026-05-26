from django.db import models

from apps.common.choices import DocumentType, EvidenceType, RequirementCriticality
from apps.common.models import TimeStampedModel


class Standard(TimeStampedModel):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    version = models.CharField(max_length=64, blank=True)
    country = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class StandardRequirement(TimeStampedModel):
    standard = models.ForeignKey(
        Standard,
        on_delete=models.CASCADE,
        related_name="requirements",
    )
    clause = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    requirement_text = models.TextField()
    process_area = models.CharField(max_length=128)
    criticality = models.CharField(
        max_length=16,
        choices=RequirementCriticality.choices,
        default=RequirementCriticality.MEDIUM,
    )
    expected_documents = models.JSONField(default=list, blank=True)
    expected_evidence = models.JSONField(default=list, blank=True)
    verification_questions = models.JSONField(default=list, blank=True)
    requires_real_evidence = models.BooleanField(default=True)
    required_document_type = models.CharField(
        max_length=32,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )
    required_evidence_type = models.CharField(
        max_length=32,
        choices=EvidenceType.choices,
        default=EvidenceType.OTHER,
    )
    sequence = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["standard__name", "sequence", "clause", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["standard", "clause", "title"],
                name="unique_requirement_per_standard_clause_title",
            )
        ]

    def __str__(self):
        return f"{self.standard.code} {self.clause} - {self.title}"
