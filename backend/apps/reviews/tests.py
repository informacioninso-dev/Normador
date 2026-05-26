import shutil
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai_engine.models import AIProviderLog
from apps.common.choices import (
    AIProvider,
    AIOperationType,
    ChecklistStatus,
    DocumentType,
    FindingType,
    RequirementEvaluationStatus,
    ReviewType,
)
from apps.companies.models import Company
from apps.documents.models import Document
from apps.implementation.models import Project
from apps.reviews.models import DocumentReview
from apps.standards.models import Standard, StandardRequirement


@override_settings(
    AI_PROVIDER=AIProvider.MOCK,
    CHUNK_SIZE_WORDS=10,
    CHUNK_OVERLAP_WORDS=2,
    REVIEW_CONTEXT_TOP_K=2,
)
class DocumentReviewApiTests(APITestCase):
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

        self.company = Company.objects.create(
            name="Review Company",
            ruc="0999999999020",
            industry="Regulado",
        )
        self.standard = Standard.objects.create(
            code="ISO_13485_REVIEW",
            name="ISO 13485 Review",
            version="2016",
            country="Internacional",
        )
        self.requirement = StandardRequirement.objects.create(
            standard=self.standard,
            clause="7.4.3",
            title="Recepcion e inspeccion",
            requirement_text=(
                "Definir recepcion documentada con criterios de aceptacion, rechazo, "
                "registro, lote, proveedor y liberacion."
            ),
            process_area="Recepcion",
            expected_documents=["Procedimiento de recepcion"],
            expected_evidence=["Registro de recepcion por lote"],
            verification_questions=["Existe criterio de aceptacion?", "Existe liberacion?"],
            sequence=1,
            required_document_type=DocumentType.PROCEDURE,
        )
        self.project = Project.objects.create(
            company=self.company,
            standard=self.standard,
            name="Proyecto Review",
            scope="Recepcion",
        )
        self.checklist_item = self.project.checklist_items.get(requirement=self.requirement)

    def test_create_document_review_runs_pipeline_and_updates_checklist(self):
        upload = SimpleUploadedFile(
            "procedimiento_recepcion.txt",
            (
                b"procedimiento de recepcion documentada con criterios de aceptacion y rechazo. "
                b"registro por lote, proveedor, inspeccion, decision de liberacion y evidencia."
            ),
            content_type="text/plain",
        )
        document_response = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": self.requirement.id,
                "checklist_item": self.checklist_item.id,
                "document_type": DocumentType.PROCEDURE,
                "file": upload,
            },
            format="multipart",
        )
        self.assertEqual(document_response.status_code, status.HTTP_201_CREATED)
        document_id = document_response.data["id"]

        review_response = self.client.post(
            "/api/document-reviews/",
            {
                "document": document_id,
                "review_type": ReviewType.REGULATORY_COMPLIANCE,
            },
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            review_response.data["overall_status"],
            RequirementEvaluationStatus.COMPLIES,
        )
        self.assertEqual(len(review_response.data["requirement_evaluations"]), 1)
        evaluation = review_response.data["requirement_evaluations"][0]
        self.assertEqual(evaluation["status"], RequirementEvaluationStatus.COMPLIES)
        self.assertFalse(evaluation["can_close_requirement"])
        self.assertTrue(evaluation["requires_real_evidence"])

        findings = review_response.data["findings"]
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["finding_type"], FindingType.IMPLEMENTATION_GAP)

        self.checklist_item.refresh_from_db()
        self.assertEqual(self.checklist_item.status, ChecklistStatus.DOCUMENT_VALIDATED)
        self.assertEqual(self.checklist_item.progress_percentage, 80)

        document = Document.objects.get(id=document_id)
        self.assertTrue(document.chunks.exists())
        self.assertEqual(DocumentReview.objects.count(), 1)
        self.assertTrue(
            AIProviderLog.objects.filter(operation_type=AIOperationType.REVIEW).exists()
        )

    def test_review_requires_ready_document(self):
        upload = SimpleUploadedFile(
            "politica.txt",
            b"contenido",
            content_type="text/plain",
        )
        document_response = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": self.requirement.id,
                "document_type": DocumentType.PROCEDURE,
                "file": upload,
            },
            format="multipart",
        )
        document = Document.objects.get(id=document_response.data["id"])
        document.status = "CARGADO"
        document.save(update_fields=["status"])

        review_response = self.client.post(
            "/api/document-reviews/",
            {
                "document": document.id,
                "review_type": ReviewType.DOCUMENT_REVIEW,
            },
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_400_BAD_REQUEST)
