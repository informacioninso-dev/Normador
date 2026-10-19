from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.ai_engine.embeddings import MockEmbeddingProvider, embed_document_chunks
from apps.ai_engine.ollama_client import OllamaAPIError
from apps.ai_engine.retriever import search_chunks
from apps.companies.models import Company, CompanyMembership, CompanyRole
from apps.documents.models import Document, DocumentProcessingJob as Job
from apps.documents.services import index_document_chunks
from apps.documents.tasks import enqueue_document, process_document_job
from apps.implementation.models import Project
from apps.standards.models import Standard, StandardRequirement


@override_settings(AI_PROVIDER="mock", CELERY_TASK_ALWAYS_EAGER=True)
class DocumentPipelineTests(TestCase):
    def test_summary_responses_keep_evidence_and_full_detail_remains_available(self):
        document = self.client.get(f"/api/documents/{self.document.pk}/", {"summary": "true"})
        self.assertEqual(document.status_code, 200)
        self.assertNotIn("extracted_text", document.data)
        self.assertEqual(self.client.get(f"/api/documents/{self.document.pk}/").data["extracted_text"], self.document.extracted_text)
        response = self.client.post("/api/document-reviews/enqueue/", {"document": self.document.pk, "review_type": "REVISION_DOCUMENTAL"}, format="json")
        review_id = Job.objects.get(pk=response.data["id"]).result["review_id"]
        summary = self.client.get(f"/api/document-reviews/{review_id}/", {"summary": "true"})
        self.assertNotIn("raw_response", summary.data)
        self.assertTrue(summary.data["requirement_evaluations"])
        self.assertIn("evidence_found", summary.data["requirement_evaluations"][0])
        self.assertIn("raw_response", self.client.get(f"/api/document-reviews/{review_id}/").data)

    def test_manual_review_can_be_queued_with_traceability(self):
        requirement = self.standard.requirements.get()
        response = self.client.post("/api/document-reviews/enqueue/", {"document": self.document.pk, "review_type": "REVISION_DOCUMENTAL", "requirements": [requirement.pk]}, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        job = Job.objects.get(pk=response.data["id"])
        self.assertEqual(job.status, "SUCCESS", job.error)
        self.assertEqual(job.operation, "REVIEW")
        review = self.document.reviews.get(pk=job.result["review_id"])
        self.assertEqual(review.created_by, self.user)
        self.assertEqual(review.review_type, "REVISION_DOCUMENTAL")
        self.assertEqual(review.provider, "mock")
        self.assertEqual(review.requirement_evaluations.count(), 1)

    def test_manual_review_queue_rejects_foreign_data_and_readers(self):
        payload = {"document": self.document.pk, "review_type": "REVISION_DOCUMENTAL", "requirements": [999999]}
        self.assertEqual(self.client.post("/api/document-reviews/enqueue/", payload, format="json").status_code, 400)
        other = get_user_model().objects.create_user(username="qa-no-review-access")
        self.client.force_authenticate(other)
        payload.pop("requirements")
        self.assertEqual(self.client.post("/api/document-reviews/enqueue/", payload, format="json").status_code, 400)
        CompanyMembership.objects.create(company=self.company, user=other, role=CompanyRole.READER)
        self.assertEqual(self.client.post("/api/document-reviews/enqueue/", payload, format="json").status_code, 400)
        self.assertFalse(Job.objects.exists())

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    def test_manual_review_does_not_hide_another_active_job(self):
        job = Job.objects.create(document=self.document, created_by=self.user, operation="INGEST", task_id=str(uuid4()))
        response = self.client.post("/api/document-reviews/enqueue/", {"document": self.document.pk, "review_type": "REVISION_DOCUMENTAL"}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Job.objects.count(), 1)
        job.refresh_from_db()
        self.assertEqual(job.status, "PENDING")

    def setUp(self):
        self.user = get_user_model().objects.create_user(username="pipeline-owner")
        self.company = Company.objects.create(
            name="QA pipeline", ruc="QA-PIPELINE", created_by=self.user
        )
        self.standard = Standard.objects.create(
            code="QA_PIPELINE", name="QA", version="1"
        )
        StandardRequirement.objects.create(
            standard=self.standard,
            clause="1",
            title="Control documental",
            requirement_text="Documentar control documental",
            process_area="Control documental",
        )
        self.project = Project.objects.create(
            name="QA", company=self.company, standard=self.standard
        )
        self.document = Document.objects.create(
            project=self.project,
            title="QA",
            file="qa.txt",
            status="LISTO",
            extracted_text="control documental recepcion almacenamiento registro validacion",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_vector_search_filters_tenant_model_and_dimensions_before_limit(self):
        index_document_chunks(self.document, provider=MockEmbeddingProvider())
        foreign_company = Company.objects.create(name="Other QA", ruc="QA-OTHER")
        foreign_project = Project.objects.create(
            name="Other", company=foreign_company, standard=self.standard
        )
        foreign = Document.objects.create(
            project=foreign_project,
            title="Other",
            file="other.txt",
            status="LISTO",
            extracted_text=self.document.extracted_text,
        )
        index_document_chunks(foreign, provider=MockEmbeddingProvider())
        stale = Document.objects.create(
            project=self.project,
            title="Stale",
            file="stale.txt",
            status="LISTO",
            extracted_text=self.document.extracted_text,
        )
        index_document_chunks(
            stale, provider=MockEmbeddingProvider(model_name="old-model")
        )
        with CaptureQueriesContext(connection) as captured:
            results = search_chunks(
                "control documental",
                provider=MockEmbeddingProvider(),
                user=self.user,
                limit=1,
            )
        self.assertEqual([r.chunk.document_id for r in results], [self.document.pk])
        self.assertIsNotNone(results[0].chunk.embedding_vector)
        if connection.vendor == "postgresql":
            ranking = [q["sql"] for q in captured if "<=>" in q["sql"]]
            self.assertEqual(len(ranking), 1)
            self.assertIn("LIMIT 1", ranking[0])
            self.assertIn("embedding_model", ranking[0])
            self.assertIn("company_id", ranking[0])

    def test_fixture_restore_does_not_autogenerate_conflicting_checklist(self):
        self.assertEqual(self.project.checklist_items.count(), 1)
        restored = Project(
            pk=999,
            name="Restored QA",
            company=self.company,
            standard=self.standard,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        restored.save_base(raw=True, force_insert=True)
        self.assertEqual(restored.checklist_items.count(), 0)

    def test_reembedding_changed_model_reuses_chunks_and_excludes_old_model(self):
        index_document_chunks(self.document, provider=MockEmbeddingProvider())
        original_ids = list(self.document.chunks.values_list("pk", flat=True))
        new_provider = MockEmbeddingProvider(model_name="new-model", dimensions=32)
        summary = index_document_chunks(
            self.document, overwrite=False, provider=new_provider
        )
        self.assertEqual(summary["created_chunks"], 0)
        self.assertEqual(
            list(self.document.chunks.values_list("pk", flat=True)), original_ids
        )
        self.assertEqual(
            search_chunks(
                "control",
                provider=MockEmbeddingProvider(),
                document_id=self.document.pk,
            ),
            [],
        )
        self.assertTrue(
            search_chunks(
                "control", provider=new_provider, document_id=self.document.pk
            )
        )
        self.document.requirement = self.standard.requirements.get()
        self.document.save(update_fields=["requirement"])
        self.assertTrue(search_chunks("control", provider=new_provider, clause="1"))
        self.assertEqual(
            search_chunks("control", provider=new_provider, clause="2"), []
        )
        self.document.extracted_text = "Nuevo texto extraido con contenido corregido."
        self.document.save(update_fields=["extracted_text"])
        index_document_chunks(self.document, overwrite=False, provider=new_provider)
        self.assertEqual(self.document.chunks.get().content, self.document.extracted_text)
        self.document.status = "FALLIDO"
        self.document.save(update_fields=["status"])
        self.assertEqual(search_chunks("contenido", provider=new_provider), [])

    def test_invalid_vectors_fail_atomically_and_are_logged(self):
        index_document_chunks(self.document, provider=MockEmbeddingProvider())
        provider = Mock(provider_name="mock", model_name="invalid")
        for vector in ([float("nan")], [0.0], [True], []):
            with self.subTest(vector=vector):
                provider.embed_texts.return_value = ([vector], {})
                with self.assertRaises(ValueError):
                    embed_document_chunks(self.document, provider=provider)
                chunk = self.document.chunks.get()
                self.assertEqual(chunk.embedding_status, "FALLIDO")
                self.assertIsNone(chunk.embedding_vector)
                self.assertEqual(chunk.embedding, [])

    def test_jobs_retry_transient_failure_then_complete_and_do_not_duplicate_delivery(
        self,
    ):
        job = Job.objects.create(
            document=self.document,
            created_by=self.user,
            operation="INDEX",
            task_id=str(uuid4()),
        )
        with patch(
            "apps.documents.tasks.index_document_chunks",
            side_effect=[
                OllamaAPIError("QA unavailable"),
                {"created_chunks": 1, "embedded_chunks": 1},
            ],
        ) as index:
            result = process_document_job.apply(
                args=[job.pk], task_id=job.task_id, throw=False
            )
            self.assertTrue(result.successful())
            job.refresh_from_db()
            self.assertEqual(job.status, "SUCCESS")
            self.assertEqual(job.attempts, 2)
            process_document_job.apply(args=[job.pk], task_id=job.task_id, throw=True)
            self.assertEqual(index.call_count, 2)
        self.assertEqual(job.created_by, self.user)
        self.assertIsNotNone(job.finished_at)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    def test_active_job_is_reused_and_broker_failure_is_visible(self):
        from kombu.exceptions import OperationalError

        with patch(
            "apps.documents.tasks.process_document_job.apply_async",
            side_effect=OperationalError("QA"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                job = enqueue_document(self.document, user=self.user, operation="INDEX")
                same = enqueue_document(
                    self.document, user=self.user, operation="INDEX"
                )
                self.assertEqual(same.pk, job.pk)
            job.refresh_from_db()
            self.assertEqual(job.status, "FAILED")
            self.assertIn("Redis", job.error)

    def test_jobs_are_private_and_reader_cannot_enqueue(self):
        index_document_chunks(self.document, provider=MockEmbeddingProvider())
        enqueue_document(self.document, user=self.user, operation="INDEX")
        reader = get_user_model().objects.create_user(username="pipeline-reader")
        self.client.force_authenticate(reader)
        endpoint = f"/api/documents/{self.document.pk}/"
        self.assertEqual(
            self.client.get(endpoint + "processing_jobs/").status_code, 404
        )
        CompanyMembership.objects.create(
            company=self.company, user=reader, role=CompanyRole.READER
        )
        response = self.client.get(endpoint + "processing_jobs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["status"], "SUCCESS")
        self.assertEqual(self.client.post(endpoint + "index_chunks/").status_code, 403)

    def test_extraction_failure_and_auto_review_have_observable_results(self):
        with TemporaryDirectory(dir=settings.BASE_DIR / "test-media") as media:
            with override_settings(MEDIA_ROOT=media):
                self.document.file = "qa.txt"
                self.document.save(update_fields=["file"])
                job = enqueue_document(self.document, user=self.user)
                self.assertEqual(job.status, "FAILED")
                self.assertEqual(job.attempts, 1)
                Path(media, "qa.txt").write_text(
                    self.document.extracted_text, encoding="utf-8"
                )
                job = enqueue_document(
                    self.document, user=self.user, review_after_processing=True
                )
                self.assertEqual(job.status, "SUCCESS", job.error)
                self.assertIn("review_id", job.result)
