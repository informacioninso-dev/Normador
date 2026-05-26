from django.conf import settings
from django.db import models

from apps.common.choices import (
    ChecklistStatus,
    DocumentType,
    EvidenceType,
    ProjectStatus,
)
from apps.common.models import TimeStampedModel


class Project(TimeStampedModel):
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    standard = models.ForeignKey(
        "standards.Standard",
        on_delete=models.PROTECT,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    scope = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
    )
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name", "standard"],
                name="unique_project_name_per_company_standard",
            )
        ]

    def __str__(self):
        return self.name


class ImplementationChecklistItem(TimeStampedModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="checklist_items",
    )
    requirement = models.ForeignKey(
        "standards.StandardRequirement",
        on_delete=models.CASCADE,
        related_name="checklist_items",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=ChecklistStatus.choices,
        default=ChecklistStatus.NOT_STARTED,
    )
    progress_percentage = models.PositiveSmallIntegerField(default=0)
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
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_checklist_items",
    )
    due_date = models.DateField(null=True, blank=True)
    is_not_applicable = models.BooleanField(default=False)
    not_applicable_justification = models.TextField(blank=True)

    class Meta:
        ordering = [
            "requirement__sequence",
            "requirement__clause",
            "id",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "requirement"],
                name="unique_checklist_item_per_project_requirement",
            )
        ]

    def __str__(self):
        return f"{self.project.name} - {self.requirement.clause}"
