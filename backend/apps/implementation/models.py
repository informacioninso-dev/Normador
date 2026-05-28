from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.choices import (
    ChecklistStatus,
    DocumentType,
    EvidenceType,
    ProjectStatus,
    WorklogActivityType,
    WorklogStatus,
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


class WorkLogEntry(TimeStampedModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="worklogs",
    )
    action_plan = models.ForeignKey(
        "action_plans.ActionPlan",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="worklogs",
    )
    consultant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="worklogs",
    )
    work_date = models.DateField(default=timezone.localdate)
    activity_type = models.CharField(
        max_length=24,
        choices=WorklogActivityType.choices,
        default=WorklogActivityType.IMPLEMENTATION,
    )
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    deliverables = models.TextField(blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    logged_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    billable_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    approved_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=16,
        choices=WorklogStatus.choices,
        default=WorklogStatus.REGISTERED,
    )
    review_notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_worklogs",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_worklogs",
    )

    class Meta:
        ordering = ["-work_date", "-created_at", "-id"]

    def __str__(self):
        return f"{self.project.name} - {self.work_date} - {self.title}"

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            start_dt = datetime.combine(self.work_date, self.start_time)
            end_dt = datetime.combine(self.work_date, self.end_time)
            if end_dt > start_dt:
                elapsed_seconds = (end_dt - start_dt).total_seconds()
                hours = Decimal(str(round(elapsed_seconds / 3600, 2)))
                self.logged_hours = hours
                if self.billable_hours == Decimal("0.00"):
                    self.billable_hours = hours
        super().save(*args, **kwargs)
