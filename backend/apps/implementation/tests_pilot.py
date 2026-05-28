import shutil
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.implementation.models import Project
from apps.reviews.report_generator import generate_project_progress_report


class DemoMediaRootMixin:
    def setUp(self):
        super().setUp()
        temp_root = Path(settings.BASE_DIR) / "test-media"
        temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_media = temp_root / f"media-{uuid4().hex}"
        self.temp_media.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.temp_media, ignore_errors=True))
        override = override_settings(MEDIA_ROOT=str(self.temp_media))
        override.enable()
        self.addCleanup(override.disable)


class PilotDemoSeedCommandTests(DemoMediaRootMixin, TestCase):
    def test_seed_demo_workspace_creates_reproducible_pilot_dataset(self):
        call_command("seed_demo_workspace", force_reset=True)

        project = Project.objects.get(name="Piloto ISO 13485 Demo")
        report = generate_project_progress_report(project)

        self.assertEqual(project.documents.count(), 3)
        self.assertEqual(project.document_reviews.count(), 3)
        self.assertEqual(project.evidences.filter(status="VALIDADA").count(), 1)

        checklist_by_clause = {
            item.requirement.clause: item.status
            for item in project.checklist_items.select_related("requirement")
        }
        self.assertEqual(checklist_by_clause["7.4.3"], "CERRADO")
        self.assertEqual(checklist_by_clause["4.2"], "VALIDADO_DOCUMENTALMENTE")
        self.assertEqual(checklist_by_clause["8.3"], "OBSERVADO")

        summary = report["summary"]
        self.assertEqual(summary["closed_requirements"], 1)
        self.assertEqual(summary["validated_evidence_count"], 1)
        self.assertEqual(summary["open_action_plans_count"], 2)
        self.assertGreaterEqual(summary["documentary_progress_percentage"], 35)

    def test_seed_demo_workspace_without_force_reset_does_not_duplicate_records(self):
        call_command("seed_demo_workspace", force_reset=True)
        first_project = Project.objects.get(name="Piloto ISO 13485 Demo")
        first_document_count = first_project.documents.count()
        first_review_count = first_project.document_reviews.count()

        call_command("seed_demo_workspace")

        second_project = Project.objects.get(name="Piloto ISO 13485 Demo")
        self.assertEqual(first_project.id, second_project.id)
        self.assertEqual(second_project.documents.count(), first_document_count)
        self.assertEqual(second_project.document_reviews.count(), first_review_count)


class PilotProgressReportApiTests(DemoMediaRootMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="pilot-api-user",
            password="secret123",
            is_staff=True,
        )
        self.client.force_authenticate(self.user)
        call_command("seed_demo_workspace", force_reset=True)
        self.project = Project.objects.get(name="Piloto ISO 13485 Demo")

    def test_progress_report_endpoint_returns_project_summary(self):
        response = self.client.get(f"/api/projects/{self.project.id}/progress_report/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["project"]["name"], "Piloto ISO 13485 Demo")
        self.assertEqual(response.data["summary"]["documents_count"], 3)
        self.assertEqual(response.data["summary"]["reviews_count"], 3)
        self.assertEqual(response.data["summary"]["validated_evidence_count"], 1)
        self.assertEqual(response.data["summary"]["open_action_plans_count"], 2)
        self.assertTrue(response.data["process_areas"])
        self.assertTrue(response.data["recommendations"])
