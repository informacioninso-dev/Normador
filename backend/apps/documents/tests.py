import shutil
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.common.choices import (
    AIProvider,
    ChecklistStatus,
    DocumentProcessingStatus,
    DocumentType,
    EmbeddingStatus,
)
from apps.companies.models import Company
from apps.documents.models import DocumentChunk
from apps.implementation.models import Project
from apps.standards.models import Standard, StandardRequirement


class DocumentUploadTests(APITestCase):
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
            name="Doc Company",
            ruc="0999999999010",
            industry="Calidad",
        )
        self.standard = Standard.objects.create(
            code="ISO_9001_TEST",
            name="ISO 9001 Test",
            version="2015",
            country="Internacional",
        )
        self.requirement = StandardRequirement.objects.create(
            standard=self.standard,
            clause="8.4",
            title="Recepcion",
            requirement_text="Verificar recepcion documentada.",
            process_area="Recepcion",
            sequence=1,
            required_document_type=DocumentType.PROCEDURE,
        )
        self.project = Project.objects.create(
            company=self.company,
            standard=self.standard,
            name="Proyecto Documental",
            scope="Recepcion",
        )
        self.checklist_item = self.project.checklist_items.get(requirement=self.requirement)

    def test_upload_txt_document_extracts_text_and_updates_checklist(self):
        upload = SimpleUploadedFile(
            "procedimiento_recepcion.txt",
            b"Linea uno de recepcion\nLinea dos del procedimiento",
            content_type="text/plain",
        )
        payload = {
            "project": self.project.id,
            "requirement": self.requirement.id,
            "checklist_item": self.checklist_item.id,
            "document_type": DocumentType.PROCEDURE,
            "file": upload,
        }

        response = self.client.post("/api/documents/", payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], DocumentProcessingStatus.READY)
        self.assertEqual(response.data["file_extension"], ".txt")
        self.assertIn("Linea uno de recepcion", response.data["extracted_text"])
        self.assertEqual(response.data["extracted_metadata"]["source_type"], "txt")

        self.checklist_item.refresh_from_db()
        self.assertEqual(self.checklist_item.status, ChecklistStatus.IN_REVIEW)
        self.assertEqual(self.checklist_item.progress_percentage, 10)

    def test_upload_rejects_requirement_from_another_standard(self):
        other_standard = Standard.objects.create(
            code="ISO_13485_TEST",
            name="ISO 13485 Test",
            version="2016",
            country="Internacional",
        )
        foreign_requirement = StandardRequirement.objects.create(
            standard=other_standard,
            clause="4.2",
            title="Control documental",
            requirement_text="Controlar documentos del otro estandar.",
            process_area="Control documental",
            sequence=1,
        )
        upload = SimpleUploadedFile(
            "politica.txt",
            b"contenido",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/documents/",
            {
                "project": self.project.id,
                "requirement": foreign_requirement.id,
                "document_type": DocumentType.POLICY,
                "file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("requirement", response.data)

    @override_settings(
        AI_PROVIDER=AIProvider.MOCK,
        CHUNK_SIZE_WORDS=4,
        CHUNK_OVERLAP_WORDS=1,
        SEMANTIC_SEARCH_TOP_K=3,
    )
    def test_index_chunks_creates_embeddings_and_semantic_search_results(self):
        upload = SimpleUploadedFile(
            "procedimiento_recepcion.txt",
            (
                b"recepcion lote inspeccion proveedor\n"
                b"almacenamiento temperatura humedad control\n"
                b"recepcion criterio aceptacion rechazo registro"
            ),
            content_type="text/plain",
        )
        create_response = self.client.post(
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
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        document_id = create_response.data["id"]

        index_response = self.client.post(f"/api/documents/{document_id}/index_chunks/", {})

        self.assertEqual(index_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(index_response.data["created_chunks"], 2)
        self.assertEqual(
            index_response.data["embedded_chunks"],
            index_response.data["created_chunks"],
        )

        chunks = DocumentChunk.objects.filter(document_id=document_id).order_by("chunk_index")
        self.assertTrue(chunks.exists())
        self.assertTrue(
            all(chunk.embedding_status == EmbeddingStatus.READY for chunk in chunks)
        )
        self.assertTrue(all(chunk.embedding_dimensions > 0 for chunk in chunks))

        search_response = self.client.post(
            "/api/document-chunks/semantic_search/",
            {
                "query": "recepcion lote rechazo",
                "document": document_id,
                "limit": 2,
            },
            format="json",
        )

        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(search_response.data["count"], 1)
        top_result = search_response.data["results"][0]
        self.assertIn("recepcion", top_result["content"].lower())
