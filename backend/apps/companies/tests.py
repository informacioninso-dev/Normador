from unittest.mock import Mock
from uuid import uuid4
import shutil
from pathlib import Path
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.action_plans.models import ActionPlan, Evidence, ImplementationActivity
from apps.companies.models import Company, CompanyMembership, CompanyRole
from apps.documents.models import Document, DocumentChunk
from apps.implementation.models import Project, WorkLogEntry, WorkLogEvidence
from apps.reviews.models import DocumentReview, RequirementEvaluation, Finding
from apps.standards.models import Standard, StandardRequirement


@override_settings(AI_PROVIDER="mock", CHUNK_SIZE_WORDS=20, CHUNK_OVERLAP_WORDS=3)
class CompanyBoundaryTests(APITestCase):
    def setUp(self):
        test_root = Path(settings.BASE_DIR) / "test-media"
        test_root.mkdir(exist_ok=True)
        directory = test_root / f"companies-{uuid4().hex}"
        directory.mkdir()
        def cleanup():
            if not directory.resolve().is_relative_to(test_root.resolve()):
                raise RuntimeError("El directorio de pruebas debe estar dentro de test-media.")
            shutil.rmtree(directory)
        self.addCleanup(cleanup)
        media = override_settings(MEDIA_ROOT=str(directory))
        media.enable()
        self.addCleanup(media.disable)
        users = get_user_model()
        self.owner = users.objects.create_user(username="owner")
        self.other = users.objects.create_user(username="other")
        self.company = Company.objects.create(name="Own", ruc="001", created_by=self.owner)
        self.foreign = Company.objects.create(name="Foreign", ruc="002", created_by=self.other)
        self.members = {}
        for role in CompanyRole:
            user = users.objects.create_user(username=role.lower())
            CompanyMembership.objects.create(company=self.company, user=user, role=role)
            self.members[role] = user
        self.standard = Standard.objects.create(code="TEST", name="Test")
        self.requirement = StandardRequirement.objects.create(standard=self.standard, clause="1", title="Control", requirement_text="Control", process_area="Control")
        self.project = Project.objects.create(company=self.company, standard=self.standard, name="Own")
        self.foreign_project = Project.objects.create(company=self.foreign, standard=self.standard, name="Foreign")
        self.document = Document.objects.create(project=self.foreign_project, title="Secret", file="documents/secret.txt", status="LISTO", extracted_text="Secret")
        self.chunk = DocumentChunk.objects.create(document=self.document, chunk_index=0, content="Secret", content_hash="secret", word_count=1)
        self.review = DocumentReview.objects.create(document=self.document, project=self.foreign_project, standard=self.standard, review_type="REVISION_DOCUMENTAL", ai_model_used="test")
        self.evaluation = RequirementEvaluation.objects.create(document_review=self.review, requirement=self.requirement, status="NO_CUMPLE")
        self.finding = Finding.objects.create(project=self.foreign_project, document_review=self.review, requirement=self.requirement, description="Secret", finding_type="BRECHA_DOCUMENTAL")
        self.plan = ActionPlan.objects.create(project=self.foreign_project, requirement=self.requirement, title="Secret")
        self.activity = ImplementationActivity.objects.create(project=self.foreign_project, title="Secret")
        self.evidence = Evidence.objects.create(project=self.foreign_project, requirement=self.requirement, description="Secret")
        self.worklog = WorkLogEntry.objects.create(project=self.foreign_project, consultant=self.other, title="Secret")
        self.worklog_evidence = WorkLogEvidence.objects.create(worklog=self.worklog, file="worklogs/secret.txt")
        self.client.force_authenticate(self.owner)

    def test_every_business_list_and_detail_hide_other_company(self):
        for route, obj in (
            ("documents", self.document), ("document-chunks", self.chunk),
            ("document-reviews", self.review), ("requirement-evaluations", self.evaluation),
            ("findings", self.finding), ("action-plans", self.plan), ("evidences", self.evidence),
            ("implementation-activities", self.activity), ("worklogs", self.worklog), ("worklog-evidences", self.worklog_evidence),
        ):
            with self.subTest(route=route):
                response = self.client.get(f"/api/{route}/")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertNotIn(obj.pk, [row["id"] for row in response.data])
                self.assertEqual(self.client.get(f"/api/{route}/{obj.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/projects/{self.foreign_project.pk}/progress_report/").status_code, 404)

    def test_foreign_mutations_and_reviews_are_denied(self):
        for url in (
            f"/api/documents/{self.document.pk}/index_chunks/",
            f"/api/evidences/{self.evidence.pk}/validate_evidence/",
            f"/api/action-plans/{self.plan.pk}/close_plan/",
            f"/api/worklogs/{self.worklog.pk}/approve/",
        ):
            self.assertEqual(self.client.post(url, {}).status_code, 404)
        self.assertEqual(self.client.post("/api/document-reviews/", {"document": self.document.pk, "review_type": "REVISION_DOCUMENTAL"}).status_code, 400)
        for route, data in (
            ("action-plans", {"project": self.foreign_project.pk, "title": "Intrusion"}),
            ("evidences", {"project": self.foreign_project.pk, "description": "Intrusion"}),
            ("implementation-activities", {"project": self.foreign_project.pk, "title": "Intrusion"}),
            ("worklog-evidences", {"worklog": self.worklog.pk}),
        ):
            with self.subTest(route=route):
                self.assertEqual(self.client.post(f"/api/{route}/", data).status_code, 400)

    def test_roles_read_but_only_writers_create(self):
        for role, user in self.members.items():
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/").status_code, 200)
            response = self.client.post("/api/projects/", {"company": self.company.pk, "standard": self.standard.pk, "name": role})
            self.assertEqual(response.status_code, 201 if role in {CompanyRole.MANAGER, CompanyRole.IMPLEMENTER} else 400, response.data)

    def test_implementer_cannot_validate_and_reader_cannot_patch(self):
        evidence = Evidence.objects.create(project=self.project, requirement=self.requirement, description="Evidence")
        self.client.force_authenticate(self.members[CompanyRole.IMPLEMENTER])
        self.assertEqual(self.client.post(f"/api/evidences/{evidence.pk}/validate_evidence/", {}).status_code, 403)
        self.client.force_authenticate(self.members[CompanyRole.AUDITOR])
        self.assertEqual(self.client.post(f"/api/evidences/{evidence.pk}/validate_evidence/", {}).status_code, 200)
        self.client.force_authenticate(self.members[CompanyRole.READER])
        self.assertEqual(self.client.patch(f"/api/projects/{self.project.pk}/", {"name": "Changed"}).status_code, 403)
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Own")

    def test_membership_management_and_deactivation(self):
        self.client.force_authenticate(self.members[CompanyRole.MANAGER])
        response = self.client.post("/api/company-memberships/", {"company": self.company.pk, "username": self.other.username, "role": CompanyRole.READER})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(CompanyMembership.objects.filter(company=self.company, user=self.other, is_active=True).exists(), response.data)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/").status_code, 200)
        self.assertEqual(self.client.post("/api/company-memberships/", {"company": self.company.pk, "username": self.owner.username, "role": CompanyRole.MANAGER}).status_code, 400)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(f"/api/company-memberships/{response.data['id']}/", {"is_active": False}).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/").status_code, 404)

    def test_company_project_filter_preserves_client_boundary(self):
        response = self.client.get("/api/projects/", {"company": self.company.pk})
        self.assertEqual([row["id"] for row in response.data], [self.project.pk])
        response = self.client.get("/api/projects/", {"company": self.foreign.pk})
        self.assertEqual(response.data, [])
        self.client.force_authenticate(self.other)
        response = self.client.get("/api/projects/", {"company": self.foreign.pk})
        self.assertEqual([row["id"] for row in response.data], [self.foreign_project.pk])

    def test_archived_company_preserves_projects_but_rejects_new_ones(self):
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        response = self.client.post("/api/projects/", {"company": self.company.pk, "standard": self.standard.pk, "name": "New project"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.client.get(f"/api/projects/{self.project.pk}/").status_code, 200)
        self.assertFalse(Project.objects.filter(company=self.company, name="New project").exists())

    def test_membership_can_be_disabled_after_account_deactivation(self):
        user = self.members[CompanyRole.READER]
        member = CompanyMembership.objects.get(company=self.company, user=user)
        user.is_active = False
        user.save(update_fields=["is_active"])
        response = self.client.patch(f"/api/company-memberships/{member.pk}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["user_is_active"])
        self.assertFalse(response.data["is_owner"])

    def test_private_references_and_semantic_search_do_not_cross_company(self):
        private = Document.objects.create(is_reference=True, library_company=self.foreign, library_standard=self.standard, title="Private", file="private.txt", status="LISTO")
        DocumentChunk.objects.create(document=private, chunk_index=0, content="secret", content_hash="p", embedding=[1.0, 0.0], embedding_vector=[1.0, 0.0], embedding_dimensions=2, embedding_provider="mock", embedding_model="test", embedding_status="LISTO")
        public = Document.objects.create(is_reference=True, library_standard=self.standard, title="Public", file="public.txt", status="LISTO")
        response = self.client.get("/api/documents/", {"is_reference": "true"})
        self.assertEqual([row["id"] for row in response.data], [public.pk])
        from apps.ai_engine.retriever import search_chunks
        provider = Mock()
        provider.provider_name = "mock"
        provider.model_name = "test"
        provider.embed_texts.return_value = ([[1.0, 0.0]], {})
        results = search_chunks("secret", provider=provider, user=self.owner, library_only=True, project_id=self.project.pk, standard_id=self.standard.pk)
        self.assertEqual(results, [])

    def test_calculated_checklist_state_and_regeneration_preserve_history(self):
        item = self.project.checklist_items.get()
        for data in ({"status": "CERRADO"}, {"requires_evidence": False}, {"is_not_applicable": True}):
            self.assertEqual(self.client.patch(f"/api/checklist-items/{item.pk}/", data).status_code, 400)
        self.assertEqual(self.client.post(f"/api/projects/{self.project.pk}/regenerate_checklist/", {"overwrite": True}).status_code, 400)
        self.assertTrue(self.project.checklist_items.filter(pk=item.pk).exists())

    def test_downloads_require_auth_and_business_records_archive(self):
        for route, obj in (("documents", self.document), ("evidences", self.evidence), ("worklog-evidences", self.worklog_evidence)):
            self.assertEqual(self.client.get(f"/api/{route}/{obj.pk}/download/").status_code, 404)
        self.assertEqual(self.client.get("/media/documents/secret.txt").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/projects/{self.project.pk}/").status_code, 204)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "ARCHIVED")
        self.assertTrue(self.project.checklist_items.exists())

    def test_document_download_is_private_and_global_library_write_requires_admin(self):
        response = self.client.post("/api/documents/", {
            "project": self.project.pk, "document_type": "PROCEDIMIENTO",
            "file": SimpleUploadedFile("test.txt", b"controlled content", content_type="text/plain"),
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["file"], f"/api/files/documents/{response.data['id']}")
        url = f"/api/documents/{response.data['id']}/download/"
        downloaded = self.client.get(url)
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(b"".join(downloaded.streaming_content), b"controlled content")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/documents/", {
            "is_reference": True, "library_standard": self.standard.pk,
            "file": SimpleUploadedFile("public.txt", b"content"),
        }, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_controlled_document_requires_human_approval_by_company_auditor(self):
        self.client.force_authenticate(self.members[CompanyRole.IMPLEMENTER])
        response = self.client.post("/api/controlled-documents/", {
            "project": self.project.pk, "code": "FO-01", "title": "Registro", "kind": "FORMATO",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        identifier = response.data["id"]
        transition = f"/api/controlled-documents/{identifier}/transition/"
        self.assertEqual(self.client.post(transition, {"expected_version": 1, "action": "submit"}, format="json").status_code, 200)
        approval = {"expected_version": 1, "action": "approve", "confirmed": True, "notes": "Revision humana completada"}
        self.assertEqual(self.client.post(transition, approval, format="json").status_code, 403)
        self.client.force_authenticate(self.members[CompanyRole.AUDITOR])
        response = self.client.post(transition, approval, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data["current_revision"])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/controlled-documents/{identifier}/").status_code, 404)
        self.client.force_authenticate(self.members[CompanyRole.READER])
        downloaded = self.client.get(f"/api/controlled-documents/{identifier}/download/", {"version": 1})
        self.assertEqual(downloaded.status_code, 200)
        self.assertTrue(b"".join(downloaded.streaming_content).startswith(b"PK"))

    def test_no_aplica_requires_human_approval_and_new_review_invalidates_it(self):
        from apps.implementation.services import recalculate_checklist_item_state
        document = Document.objects.create(project=self.project, title="Scope", file="scope.txt", status="LISTO")
        review = DocumentReview.objects.create(document=document, project=self.project, standard=self.standard, review_type="REVISION_DOCUMENTAL", ai_model_used="test")
        RequirementEvaluation.objects.create(document_review=review, requirement=self.requirement, status="NO_APLICA")
        item = self.project.checklist_items.get()
        recalculate_checklist_item_state(item)
        self.assertEqual(item.status, "OBSERVADO")
        url = f"/api/checklist-items/{item.pk}/confirm_not_applicable/"
        self.client.force_authenticate(self.members[CompanyRole.IMPLEMENTER])
        self.assertEqual(self.client.post(url, {"confirmed": True, "justification": "Fuera del alcance"}, format="json").status_code, 403)
        self.client.force_authenticate(self.members[CompanyRole.AUDITOR])
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        response = self.client.post(url, {"confirmed": True, "justification": "Fuera del alcance revisado"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "CERRADO")
        self.assertEqual(response.data["not_applicable_approved_by"], self.members[CompanyRole.AUDITOR].pk)
        newer = DocumentReview.objects.create(document=document, project=self.project, standard=self.standard, review_type="REVISION_DOCUMENTAL", ai_model_used="test")
        RequirementEvaluation.objects.create(document_review=newer, requirement=self.requirement, status="NO_APLICA")
        item.refresh_from_db()
        recalculate_checklist_item_state(item)
        self.assertEqual(item.status, "OBSERVADO")

    def test_validated_evidence_and_reviewed_document_cannot_be_overwritten(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch(f"/api/documents/{self.document.pk}/", {"title": "Overwrite"})
        self.assertEqual(response.status_code, 400)
        self.evidence.status = "VALIDADA"
        self.evidence.save(update_fields=["status"])
        response = self.client.patch(f"/api/evidences/{self.evidence.pk}/", {"description": "Changed"})
        self.assertEqual(response.status_code, 400)

    def test_invalid_identifiers_return_validation_errors(self):
        self.assertEqual(self.client.get("/api/documents/", {"project": "invalid"}).status_code, 400)
        self.assertEqual(self.client.post("/api/document-chunks/semantic_search/", {"query": "test", "project": "invalid"}).status_code, 400)
