from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
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
