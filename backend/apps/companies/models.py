from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Company(TimeStampedModel):
    name = models.CharField(max_length=255)
    ruc = models.CharField(max_length=32, unique=True)
    industry = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="companies",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CompanyRole(models.TextChoices):
    MANAGER = "RESPONSABLE", "Responsable"
    IMPLEMENTER = "IMPLEMENTADOR", "Implementador"
    AUDITOR = "AUDITOR", "Auditor"
    READER = "LECTOR", "Lector"


class CompanyMembership(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="company_memberships")
    role = models.CharField(max_length=20, choices=CompanyRole.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "user"], name="unique_company_member")]
        ordering = ["company_id", "user_id"]
