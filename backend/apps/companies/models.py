from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Company(TimeStampedModel):
    name = models.CharField(max_length=255)
    ruc = models.CharField(max_length=32, unique=True)
    industry = models.CharField(max_length=255, blank=True)
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
