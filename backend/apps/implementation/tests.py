from django.test import TestCase

from apps.common.choices import ChecklistItemType, DocumentProcessingStatus
from apps.companies.models import Company
from apps.documents.models import Document
from apps.implementation.models import Project
from apps.standards.models import Standard, StandardRequirement


class ProjectChecklistGenerationTests(TestCase):
    def test_project_creation_generates_checklist_items_from_standard_requirements(self):
        company = Company.objects.create(
            name="Demo Company",
            ruc="0999999999001",
            industry="Manufactura",
        )
        standard = Standard.objects.create(
            code="ISO_9001",
            name="ISO 9001",
            version="2015",
            country="Internacional",
        )
        req_1 = StandardRequirement.objects.create(
            standard=standard,
            clause="7.5",
            title="Control documental",
            requirement_text="Controlar documentos vigentes.",
            process_area="Control documental",
            sequence=1,
        )
        req_2 = StandardRequirement.objects.create(
            standard=standard,
            clause="8.4",
            title="Recepcion",
            requirement_text="Verificar insumos recibidos.",
            process_area="Recepcion",
            sequence=2,
        )

        project = Project.objects.create(
            company=company,
            standard=standard,
            name="Proyecto ISO",
            scope="Alcance inicial",
        )

        checklist = list(project.checklist_items.order_by("requirement__sequence"))

        self.assertEqual(len(checklist), 2)
        self.assertEqual(checklist[0].requirement, req_1)
        self.assertEqual(checklist[1].requirement, req_2)
        self.assertEqual(checklist[0].item_type, ChecklistItemType.CONTROL)
        self.assertTrue(checklist[0].title.startswith("Implementar y controlar"))
        self.assertIn(req_1.requirement_text, checklist[0].description)
        self.assertIn("Definir responsable", checklist[0].implementation_task)
        self.assertTrue(checklist[0].requires_evidence)
        self.assertTrue(checklist[0].acceptance_criteria)
        self.assertTrue(checklist[0].review_questions)

    def test_project_creation_can_derive_checklist_from_reference_library(self):
        company = Company.objects.create(
            name="Library Company",
            ruc="0999999999002",
            industry="Consultoria",
        )
        standard = Standard.objects.create(
            code="ISO_9001_LIBRARY",
            name="ISO 9001 Library",
            version="2015",
            country="Internacional",
        )
        Document.objects.create(
            is_reference=True,
            title="ISO 9001 Library reference",
            file="documents/reference/iso-9001-library.txt",
            file_name="iso-9001-library.txt",
            file_extension=".txt",
            status=DocumentProcessingStatus.READY,
            extracted_text=(
                "ISO 9001 Library\n"
                "7.5 Informacion documentada para el sistema de gestion\n"
                "8.7 Control de salidas no conformes\n"
                "9.2 Auditoria interna del sistema\n"
            ),
        )

        project = Project.objects.create(
            company=company,
            standard=standard,
            name="Proyecto desde biblioteca",
            scope="Alcance inicial",
        )

        checklist = list(project.checklist_items.order_by("requirement__sequence"))

        self.assertEqual(len(checklist), 3)
        self.assertEqual(
            [item.requirement.clause for item in checklist],
            ["7.5", "8.7", "9.2"],
        )
        self.assertTrue(
            all("Informacion documentada para el sistema" not in item.description for item in checklist)
        )
        self.assertEqual(checklist[0].requirement.process_area, "Control documental")
        self.assertTrue(all(item.requires_document for item in checklist))
        self.assertTrue(all(item.requires_evidence for item in checklist))
