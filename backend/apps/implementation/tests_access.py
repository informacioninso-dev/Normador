from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.companies.models import Company
from apps.implementation.models import Project
from apps.standards.models import Standard, StandardRequirement


class ProjectIsolationTests(APITestCase):
    """RF-02 / T-11: owner scope applies to reads and company reassignment."""

    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(username="owner")
        self.other = users.objects.create_user(username="other")
        self.admin = users.objects.create_user(username="admin", is_staff=True)
        self.company = Company.objects.create(name="Own", ruc="001", created_by=self.owner)
        self.foreign = Company.objects.create(name="Foreign", ruc="002", created_by=self.other)
        self.standard = Standard.objects.create(code="TEST", name="Test")
        StandardRequirement.objects.create(
            standard=self.standard, clause="1", title="Control", requirement_text="Control", process_area="Control"
        )
        self.project = Project.objects.create(company=self.company, standard=self.standard, name="Own")
        self.foreign_project = Project.objects.create(company=self.foreign, standard=self.standard, name="Foreign")
        self.client.force_authenticate(self.owner)

    def test_lists_and_details_hide_foreign_data(self):
        for resource, own, foreign in (
            ("companies", self.company, self.foreign),
            ("projects", self.project, self.foreign_project),
            ("checklist-items", self.project.checklist_items.get(), self.foreign_project.checklist_items.get()),
        ):
            with self.subTest(resource=resource):
                response = self.client.get(f"/api/{resource}/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual([row["id"] for row in response.data], [own.pk])
                self.assertEqual(self.client.get(f"/api/{resource}/{foreign.pk}/").status_code, 404)
                self.assertEqual(self.client.patch(f"/api/{resource}/{foreign.pk}/", {}).status_code, 404)

    def test_cannot_create_in_or_transfer_to_foreign_company(self):
        payload = {"company": self.foreign.pk, "standard": self.standard.pk, "name": "Intrusion"}
        self.assertEqual(self.client.post("/api/projects/", payload).status_code, 400)
        response = self.client.patch(f"/api/projects/{self.project.pk}/", {"company": self.foreign.pk})
        self.assertEqual(response.status_code, 400)
        self.project.refresh_from_db()
        self.assertEqual(self.project.company_id, self.company.pk)
        self.assertEqual(Project.objects.count(), 2)

    def test_owner_can_create_and_admin_can_access_all(self):
        response = self.client.post("/api/projects/", {
            "company": self.company.pk, "standard": self.standard.pk, "name": "New",
        })
        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f"/api/projects/{self.foreign_project.pk}/").status_code, 200)
        self.assertEqual(len(self.client.get("/api/checklist-items/").data), 3)
