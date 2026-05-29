from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.companies.models import Company
from apps.implementation.models import Project, WorkLogEntry
from apps.standards.models import Standard, StandardRequirement


class WorkLogEntryApiTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="asesor-demo",
            password="secret123",
            is_staff=True,
        )
        self.client.force_authenticate(self.user)
        self.company = Company.objects.create(
            name="Company Worklog",
            ruc="0999999999091",
            industry="Calidad",
            created_by=self.user,
        )
        self.standard = Standard.objects.create(
            code="ISO_9001_WORKLOG",
            name="ISO 9001 Worklog",
            version="2015",
            country="Internacional",
        )
        StandardRequirement.objects.create(
            standard=self.standard,
            clause="7.5",
            title="Control documental",
            requirement_text="Controlar documentos vigentes.",
            process_area="Control documental",
            sequence=1,
        )
        self.project = Project.objects.create(
            company=self.company,
            standard=self.standard,
            name="Proyecto Worklog",
            scope="Piloto",
        )

    def test_create_worklog_computes_hours_and_defaults_consultant(self):
        response = self.client.post(
            "/api/worklogs/",
            {
                "project": self.project.id,
                "work_date": "2026-05-28",
                "activity_type": "IMPLEMENTACION",
                "title": "Levantamiento con cliente",
                "summary": "Revision de brechas y plan de trabajo.",
                "start_time": "09:00:00",
                "end_time": "11:30:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["consultant"], self.user.id)
        self.assertEqual(response.data["logged_hours"], "2.50")
        self.assertEqual(response.data["billable_hours"], "2.50")

    def test_create_worklog_treats_null_billable_hours_as_auto_calculated(self):
        response = self.client.post(
            "/api/worklogs/",
            {
                "project": self.project.id,
                "work_date": "2026-05-28",
                "activity_type": "IMPLEMENTACION",
                "title": "Jornada con facturable automatico",
                "start_time": "09:00:00",
                "end_time": "11:30:00",
                "billable_hours": None,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["logged_hours"], "2.50")
        self.assertEqual(response.data["billable_hours"], "2.50")

    @override_settings(AI_PROVIDER="ollama")
    def test_assistant_create_worklog_from_natural_language(self):
        with patch("apps.implementation.worklog_assistant._parse_with_ollama") as ollama_parser:
            response = self.client.post(
                "/api/worklogs/assistant-create/",
                {
                    "project": self.project.id,
                    "instruction": "capacitacion con el titulo POE del proceso 4 desde las 8 am hasta las 9",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ollama_parser.assert_not_called()
        self.assertEqual(response.data["worklog"]["activity_type"], "CAPACITACION")
        self.assertIn("POE del proceso 4", response.data["worklog"]["title"])
        self.assertEqual(response.data["worklog"]["start_time"], "08:00:00")
        self.assertEqual(response.data["worklog"]["end_time"], "09:00:00")
        self.assertEqual(response.data["worklog"]["logged_hours"], "1.00")
        self.assertEqual(response.data["worklog"]["billable_hours"], "1.00")

    @override_settings(AI_PROVIDER="ollama")
    def test_assistant_interprets_noon_after_morning_start(self):
        response = self.client.post(
            "/api/worklogs/assistant-create/",
            {
                "project": self.project.id,
                "instruction": (
                    "revision documentar del poe de apilamiento de cajs "
                    "dese las 10 am hasta las 12"
                ),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["worklog"]["activity_type"], "REVISION")
        self.assertEqual(response.data["worklog"]["start_time"], "10:00:00")
        self.assertEqual(response.data["worklog"]["end_time"], "12:00:00")
        self.assertEqual(response.data["worklog"]["logged_hours"], "2.00")

    @override_settings(AI_PROVIDER="ollama")
    def test_assistant_accepts_speech_ampm_and_title_after_time(self):
        response = self.client.post(
            "/api/worklogs/assistant-create/",
            {
                "project": self.project.id,
                "instruction": "capacitación desde las 11 a.m hasta las 12 p.m título baile",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["worklog"]["activity_type"], "CAPACITACION")
        self.assertEqual(response.data["worklog"]["title"], "baile")
        self.assertEqual(response.data["worklog"]["start_time"], "11:00:00")
        self.assertEqual(response.data["worklog"]["end_time"], "12:00:00")
        self.assertEqual(response.data["worklog"]["logged_hours"], "1.00")

    @override_settings(AI_PROVIDER="ollama")
    def test_assistant_ignores_numbers_in_title_before_time_range(self):
        response = self.client.post(
            "/api/worklogs/assistant-create/",
            {
                "project": self.project.id,
                "instruction": "capacitacion del Poe 456 78 a las 8 a.m hasta las 10",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["worklog"]["activity_type"], "CAPACITACION")
        self.assertIn("Poe 456 78", response.data["worklog"]["title"])
        self.assertEqual(response.data["worklog"]["start_time"], "08:00:00")
        self.assertEqual(response.data["worklog"]["end_time"], "10:00:00")
        self.assertEqual(response.data["worklog"]["logged_hours"], "2.00")

    def test_observe_worklog_allows_empty_approved_hours(self):
        worklog = WorkLogEntry.objects.create(
            project=self.project,
            consultant=self.user,
            created_by=self.user,
            work_date=date(2026, 5, 28),
            activity_type="REVISION",
            title="Revision documental",
            logged_hours=Decimal("2.00"),
            billable_hours=Decimal("2.00"),
        )

        response = self.client.post(
            f"/api/worklogs/{worklog.id}/observe/",
            {
                "approved_hours": None,
                "review_notes": "Falta soporte documental.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        worklog.refresh_from_db()
        self.assertEqual(worklog.status, "OBSERVADO")
        self.assertEqual(worklog.approved_hours, Decimal("0.00"))
        self.assertEqual(worklog.review_notes, "Falta soporte documental.")

    def test_approve_worklog_updates_status_and_approved_hours(self):
        worklog = WorkLogEntry.objects.create(
            project=self.project,
            consultant=self.user,
            created_by=self.user,
            work_date=date(2026, 5, 28),
            activity_type="REVISION",
            title="Revision documental",
            logged_hours=Decimal("3.00"),
            billable_hours=Decimal("2.50"),
        )

        response = self.client.post(
            f"/api/worklogs/{worklog.id}/approve/",
            {
                "approved_hours": "2.00",
                "review_notes": "Aprobado segun soporte entregado.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        worklog.refresh_from_db()
        self.assertEqual(worklog.status, "APROBADO")
        self.assertEqual(worklog.approved_hours, Decimal("2.00"))


class WorkLogReportTests(TestCase):
    def test_progress_report_includes_worklog_summary(self):
        user = get_user_model().objects.create_user(
            username="consultor-report",
            password="secret123",
        )
        company = Company.objects.create(
            name="Report Company",
            ruc="0999999999092",
            industry="Consultoria",
            created_by=user,
        )
        standard = Standard.objects.create(
            code="ISO_13485_WORKLOG",
            name="ISO 13485 Worklog",
            version="2016",
            country="Internacional",
        )
        StandardRequirement.objects.create(
            standard=standard,
            clause="4.2",
            title="Control documental",
            requirement_text="Controlar informacion documentada.",
            process_area="Control documental",
            sequence=1,
        )
        project = Project.objects.create(
            company=company,
            standard=standard,
            name="Proyecto Reporte Horas",
        )
        WorkLogEntry.objects.create(
            project=project,
            consultant=user,
            created_by=user,
            work_date=date(2026, 5, 28),
            activity_type="IMPLEMENTACION",
            title="Sesion 1",
            logged_hours=Decimal("2.00"),
            billable_hours=Decimal("2.00"),
            approved_hours=Decimal("1.50"),
            status="APROBADO",
        )

        from apps.reviews.report_generator import generate_project_progress_report

        report = generate_project_progress_report(project)

        self.assertEqual(report["summary"]["worklog_entries_count"], 1)
        self.assertEqual(report["summary"]["logged_hours"], 2.0)
        self.assertEqual(report["summary"]["approved_hours"], 1.5)
        self.assertEqual(report["worklog"]["by_consultant"][0]["consultant"], "consultor-report")
