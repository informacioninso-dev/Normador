from django.test import TestCase

from apps.companies.models import Company
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
        self.assertEqual(checklist[0].title, req_1.title)
        self.assertEqual(checklist[0].description, req_1.requirement_text)
