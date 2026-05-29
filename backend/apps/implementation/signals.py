from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.implementation.models import Project
from apps.implementation.services import generate_checklist_for_project


@receiver(post_save, sender=Project)
def create_project_checklist(sender, instance: Project, created: bool, **kwargs):
    if created and instance.standard_id:
        generate_checklist_for_project(instance, use_library=True)
