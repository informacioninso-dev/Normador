import shutil
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.action_plans.models import ActionPlan, Evidence, ImplementationActivity
from apps.common.choices import (
    AIProvider,
    ActionPlanStatus,
    ChecklistStatus,
    DocumentType,
    EvidenceType,
    EvidenceValidationStatus,
    FindingStatus,
    FindingType,
    ImplementationActivityType,
    RequirementEvaluationStatus,
    ReviewType,
)
from apps.companies.models import Company
from apps.implementation.models import Project
from apps.reviews.models import Finding
from apps.standards.models import Standard, StandardRequirement


@override_settings(
    AI_PROVIDER=AIProvider.MOCK,
    CHUNK_SIZE_WORDS=12,
    CHUNK_OVERLAP_WORDS=2,
    REVIEW_CONTEXT_TOP_K=2,
)
class ActionPlanAndEvidenceApiTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="phase5-user",
            password="secret123",
        )
        self.client.force_authenticate(self.user)
        temp_root = Path(settings.BASE_DIR) / "test-media"
        temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_media = temp_root / f"media-{uuid4().hex}"
        self.temp_media.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.temp_media, ignore_errors=True))
        override = override_settings(MEDIA_ROOT=str(self.temp_media))
        override.enable()
        self.addCleanup(override.disable)

        self.company = Company.objects.create(
            name="Phase 5 Company",
            ruc="0999999999030",
            industry="Dispositivos",
        )
        self.standard = Standard.objects.create(
            code="ISO_13485_ACTIONS",
            name="ISO 13485 Actions",
            version="2016",
            country="Internacional",
        )
        self.requirement = StandardRequirement.objects.create(
            standard=self.standard,
            clause="7.4.3",
            title="Recepcion e inspeccion",
            requirement_text=(
                "Definir recepcion documentada con criterios de aceptacion, rechazo, "
                "lote, proveedor, inspeccion y liberacion."
            ),
            process_area="Recepcion",
            expected_documents=["Procedimiento de recepcion"],
            expected_evidence=["Registro de recepcion por lote"],
            sequence=1,
            requires_real_evidence=True,
            required_document_type=DocumentType.PROCEDURE,
            required_evidence_type=EvidenceType.RECORD,
        )
        self.project = Project.objects.create(
            company=self.company,
            standard=self.standard,
            name="Proyecto Fase 5",
            scope="Recepcion",
        )
        self.checklist_item = self.project.checklist_items.get(requirement=self.requirement)

    def test_review_generates_action_plan_then_validated_evidence_closes_requirement(self):
        document_response = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": self.requirement.id,
                "checklist_item": self.checklist_item.id,
                "document_type": DocumentType.PROCEDURE,
                "file": SimpleUploadedFile(
                    "procedimiento_recepcion.txt",
                    (
                        b"procedimiento de recepcion documentada con criterios de aceptacion y rechazo. "
                        b"registro por lote, proveedor, inspeccion, decision de liberacion."
                    ),
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        self.assertEqual(document_response.status_code, status.HTTP_201_CREATED)

        review_response = self.client.post(
            "/api/document-reviews/",
            {
                "document": document_response.data["id"],
                "review_type": ReviewType.REGULATORY_COMPLIANCE,
            },
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            review_response.data["overall_status"],
            RequirementEvaluationStatus.COMPLIES,
        )

        finding = Finding.objects.get(project=self.project)
        self.assertEqual(finding.finding_type, FindingType.IMPLEMENTATION_GAP)
        action_plan = ActionPlan.objects.get(project=self.project)
        self.assertEqual(action_plan.finding_id, finding.id)
        self.assertEqual(action_plan.status, ActionPlanStatus.PENDING)

        invalid_close_response = self.client.post(
            f"/api/action-plans/{action_plan.id}/close_plan/",
            {"completion_notes": "Intento sin evidencia"},
            format="json",
        )
        self.assertEqual(invalid_close_response.status_code, status.HTTP_400_BAD_REQUEST)

        start_response = self.client.post(
            f"/api/action-plans/{action_plan.id}/start_progress/",
            {},
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_200_OK)
        action_plan.refresh_from_db()
        self.assertEqual(action_plan.status, ActionPlanStatus.IN_PROGRESS)

        activity = ImplementationActivity.objects.filter(action_plan=action_plan).latest("id")
        self.assertEqual(activity.activity_type, ImplementationActivityType.START)

        evidence_response = self.client.post(
            "/api/evidences/",
            {
                "action_plan": action_plan.id,
                "evidence_type": EvidenceType.RECORD,
                "description": "Registro diligenciado de recepcion por lote.",
                "file": SimpleUploadedFile(
                    "registro_recepcion.txt",
                    b"registro de recepcion lote proveedor liberacion",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        self.assertEqual(evidence_response.status_code, status.HTTP_201_CREATED)
        evidence = Evidence.objects.get(id=evidence_response.data["id"])
        self.assertEqual(evidence.status, EvidenceValidationStatus.UPLOADED)

        validate_response = self.client.post(
            f"/api/evidences/{evidence.id}/validate_evidence/",
            {"validation_notes": "Validado contra ejecucion real."},
            format="json",
        )
        self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
        evidence.refresh_from_db()
        self.assertEqual(evidence.status, EvidenceValidationStatus.VALIDATED)

        self.checklist_item.refresh_from_db()
        self.assertEqual(self.checklist_item.status, ChecklistStatus.IMPLEMENTED)
        self.assertEqual(self.checklist_item.progress_percentage, 90)

        resolve_response = self.client.post(
            f"/api/action-plans/{action_plan.id}/resolve/",
            {"completion_notes": "Se ejecuto el plan y se adjunto evidencia."},
            format="json",
        )
        self.assertEqual(resolve_response.status_code, status.HTTP_200_OK)
        action_plan.refresh_from_db()
        self.assertEqual(action_plan.status, ActionPlanStatus.RESOLVED)

        resolve_activity = ImplementationActivity.objects.filter(action_plan=action_plan).latest("id")
        self.assertEqual(resolve_activity.activity_type, ImplementationActivityType.DELIVERABLE)

        close_response = self.client.post(
            f"/api/action-plans/{action_plan.id}/close_plan/",
            {"completion_notes": "Cierre validado por evidencia real."},
            format="json",
        )
        self.assertEqual(close_response.status_code, status.HTTP_200_OK)

        action_plan.refresh_from_db()
        finding.refresh_from_db()
        self.checklist_item.refresh_from_db()
        self.assertEqual(action_plan.status, ActionPlanStatus.CLOSED)
        self.assertEqual(finding.status, FindingStatus.CLOSED)
        self.assertEqual(self.checklist_item.status, ChecklistStatus.CLOSED)
        self.assertEqual(self.checklist_item.progress_percentage, 100)
        close_activity = ImplementationActivity.objects.filter(action_plan=action_plan).latest("id")
        self.assertEqual(close_activity.activity_type, ImplementationActivityType.CLOSURE)

    def test_manual_implementation_activity_is_registered_for_action_plan(self):
        action_plan = ActionPlan.objects.create(
            project=self.project,
            requirement=self.requirement,
            checklist_item=self.checklist_item,
            title="Seguimiento recepcion",
            description="Pendiente operativo",
        )

        response = self.client.post(
            "/api/implementation-activities/",
            {
                "action_plan": action_plan.id,
                "activity_type": ImplementationActivityType.BLOCKER,
                "title": "Proveedor no entrega formato",
                "notes": "Sin formato aprobado para recepcion.",
                "next_follow_up_on": "2026-06-02",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["project"], self.project.id)
        self.assertEqual(response.data["requirement"], self.requirement.id)
        self.assertEqual(response.data["checklist_item"], self.checklist_item.id)
        self.assertEqual(response.data["activity_type"], ImplementationActivityType.BLOCKER)

        action_plan.refresh_from_db()
        self.assertEqual(action_plan.activities.count(), 1)


@override_settings(
    AI_PROVIDER=AIProvider.MOCK,
    CHUNK_SIZE_WORDS=12,
    CHUNK_OVERLAP_WORDS=2,
    REVIEW_CONTEXT_TOP_K=2,
)
class ActionPlanSupersedeTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="supersede-user",
            password="secret123",
        )
        self.client.force_authenticate(self.user)
        temp_root = Path(settings.BASE_DIR) / "test-media"
        temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_media = temp_root / f"media-{uuid4().hex}"
        self.temp_media.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.temp_media, ignore_errors=True))
        override = override_settings(MEDIA_ROOT=str(self.temp_media))
        override.enable()
        self.addCleanup(override.disable)

        self.company = Company.objects.create(
            name="Supersede Company",
            ruc="0999999999040",
            industry="Calidad",
        )
        self.standard = Standard.objects.create(
            code="ISO_9001_SUPERSEDE",
            name="ISO 9001 Supersede",
            version="2015",
            country="Internacional",
        )
        self.requirement = StandardRequirement.objects.create(
            standard=self.standard,
            clause="8.7",
            title="Producto no conforme",
            requirement_text=(
                "Definir disposicion, segregacion, identificacion y registro de producto no conforme."
            ),
            process_area="Producto no conforme",
            expected_documents=["Procedimiento de producto no conforme"],
            expected_evidence=[],
            sequence=1,
            requires_real_evidence=False,
            required_document_type=DocumentType.PROCEDURE,
        )
        self.project = Project.objects.create(
            company=self.company,
            standard=self.standard,
            name="Proyecto Supersede",
            scope="PNC",
        )
        self.checklist_item = self.project.checklist_items.get(requirement=self.requirement)

    def test_new_review_supersedes_previous_auto_generated_plan(self):
        weak_document = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": self.requirement.id,
                "checklist_item": self.checklist_item.id,
                "document_type": DocumentType.PROCEDURE,
                "file": SimpleUploadedFile(
                    "pnc_incompleto.txt",
                    b"texto sin criterios claros ni disposicion formal",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        self.assertEqual(weak_document.status_code, status.HTTP_201_CREATED)

        weak_review = self.client.post(
            "/api/document-reviews/",
            {
                "document": weak_document.data["id"],
                "review_type": ReviewType.DOCUMENT_REVIEW,
            },
            format="json",
        )
        self.assertEqual(weak_review.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            weak_review.data["overall_status"],
            RequirementEvaluationStatus.DOES_NOT_COMPLY,
        )

        first_plan = ActionPlan.objects.get(project=self.project)
        first_finding = Finding.objects.get(project=self.project)
        self.assertEqual(first_plan.status, ActionPlanStatus.PENDING)
        self.assertEqual(first_finding.status, FindingStatus.OPEN)
        self.checklist_item.refresh_from_db()
        self.assertEqual(self.checklist_item.status, ChecklistStatus.OBSERVED)

        strong_document = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": self.requirement.id,
                "checklist_item": self.checklist_item.id,
                "document_type": DocumentType.PROCEDURE,
                "file": SimpleUploadedFile(
                    "pnc_completo.txt",
                    (
                        b"procedimiento de producto no conforme con disposicion, segregacion, "
                        b"identificacion, registro y responsable de liberacion."
                    ),
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        self.assertEqual(strong_document.status_code, status.HTTP_201_CREATED)

        strong_review = self.client.post(
            "/api/document-reviews/",
            {
                "document": strong_document.data["id"],
                "review_type": ReviewType.DOCUMENT_REVIEW,
            },
            format="json",
        )
        self.assertEqual(strong_review.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            strong_review.data["overall_status"],
            RequirementEvaluationStatus.COMPLIES,
        )
        self.assertEqual(strong_review.data["findings"], [])

        first_plan.refresh_from_db()
        first_finding.refresh_from_db()
        self.checklist_item.refresh_from_db()
        self.assertEqual(first_plan.status, ActionPlanStatus.SUPERSEDED)
        self.assertEqual(first_finding.status, FindingStatus.CLOSED)
        self.assertEqual(self.checklist_item.status, ChecklistStatus.CLOSED)
        self.assertEqual(self.checklist_item.progress_percentage, 100)
