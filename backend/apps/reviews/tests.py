import shutil
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
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
from unittest.mock import patch


@override_settings(
    AI_PROVIDER=AIProvider.MOCK,
    CHUNK_SIZE_WORDS=10,
    CHUNK_OVERLAP_WORDS=2,
    REVIEW_CONTEXT_TOP_K=2,
)
class DocumentReviewApiTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="reviewer",
            password="testpass",
            is_staff=True,
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
        self.assertEqual(review_response.data["provider"], "mock")
        provider_log = AIProviderLog.objects.get(operation_type="review", status="success")
        self.assertEqual(provider_log.request_payload["review_id"], review_response.data["id"])
        self.assertEqual(provider_log.created_by, self.user)
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


    def test_invalid_model_output_is_logged_without_persisting_review(self):
        from apps.reviews.iso_reviewer import MockReviewProvider
        from apps.action_plans.models import ActionPlan
        from apps.reviews.models import RequirementEvaluation, Finding
        upload = SimpleUploadedFile("test.txt", b"recepcion lote inspeccion registro", content_type="text/plain")
        response = self.client.post("/api/documents/", {
            "project": self.project.pk, "requirement": self.requirement.pk,
            "document_type": "PROCEDIMIENTO", "file": upload,
        }, format="multipart")
        self.assertEqual(response.status_code, 201)
        for invalid in ({}, {"overall_status": "CUMPLE", "requirement_evaluations": []}):
            with patch.object(MockReviewProvider, "run_review", return_value=(invalid, {})):
                review = self.client.post("/api/document-reviews/", {
                    "document": response.data["id"], "review_type": "REVISION_DOCUMENTAL",
                }, format="json")
            self.assertEqual(review.status_code, 502, review.data)
        self.assertFalse(DocumentReview.objects.exists())
        self.assertFalse(RequirementEvaluation.objects.exists())
        self.assertFalse(Finding.objects.exists())
        self.assertFalse(ActionPlan.objects.exists())
        self.assertEqual(AIProviderLog.objects.filter(operation_type="review", status="error").count(), 2)

    def test_contract_rejects_duplicate_missing_wrong_types_and_invented_citations(self):
        from apps.reviews.iso_reviewer import MockReviewProvider
        import copy
        original = MockReviewProvider.run_review
        response = self.client.post("/api/documents/", {
            "project": self.project.pk, "requirement": self.requirement.pk,
            "document_type": "PROCEDIMIENTO",
            "file": SimpleUploadedFile("test.txt", b"recepcion lote inspeccion registro proveedor"),
        }, format="multipart")
        self.assertEqual(response.status_code, 201)
        for mutation in ("duplicate", "missing", "boolean", "citation", "foreign"):
            def invalid(provider, context):
                payload, metadata = original(provider, context)
                evaluation = payload["requirement_evaluations"][0]
                if mutation == "duplicate":
                    payload["requirement_evaluations"].append(copy.deepcopy(evaluation))
                elif mutation == "missing":
                    payload["requirement_evaluations"] = []
                elif mutation == "boolean":
                    evaluation["can_close_requirement"] = "false"
                elif mutation == "citation":
                    evaluation["evidence_found"] = "EVIDENCIA QUE NO EXISTE EN EL DOCUMENTO"
                else:
                    evaluation["requirement_id"] = 999999
                return payload, metadata
            with self.subTest(mutation=mutation), patch.object(MockReviewProvider, "run_review", invalid):
                result = self.client.post("/api/document-reviews/", {"document": response.data["id"], "review_type": "REVISION_DOCUMENTAL"}, format="json")
                self.assertEqual(result.status_code, 502, result.data)
        self.assertFalse(DocumentReview.objects.exists())

    def test_provider_failure_keeps_auditable_error_without_a_review(self):
        from apps.reviews.iso_reviewer import MockReviewProvider
        from apps.ai_engine.ollama_client import OllamaAPIError
        response = self.client.post("/api/documents/", {
            "project": self.project.pk, "requirement": self.requirement.pk,
            "document_type": "PROCEDIMIENTO", "file": SimpleUploadedFile("test.txt", b"recepcion registro"),
        }, format="multipart")
        with patch.object(MockReviewProvider, "run_review", side_effect=OllamaAPIError("Unavailable")):
            result = self.client.post("/api/document-reviews/", {"document": response.data["id"], "review_type": "REVISION_DOCUMENTAL"}, format="json")
        self.assertEqual(result.status_code, 502)
        self.assertFalse(DocumentReview.objects.exists())
        log = AIProviderLog.objects.get(operation_type="review", status="error")
        self.assertEqual(log.created_by, self.user)
        self.assertTrue(log.prompt_version)
