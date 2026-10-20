from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.companies.models import Company, CompanyMembership, CompanyRole


class AuthenticationTests(APITestCase):
    """RF-01 / T-10: exercise real JWT authentication, not forced sessions."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="owner", password="test-password-123"
        )

    def login(self, password="test-password-123"):
        return self.client.post("/api/auth/login/", {
            "username": self.user.username, "password": password,
        }, format="json")

    def test_login_me_and_refresh(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        response_me = self.client.get("/api/auth/me/")
        self.assertEqual(response_me.status_code, 200)
        self.assertEqual(response_me.data["id"], self.user.pk)
        refreshed = self.client.post("/api/auth/refresh/", {"refresh": response.data["refresh"]})
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.data)

    def test_invalid_credentials_and_inactive_account_cannot_login(self):
        self.assertEqual(self.login("incorrect").status_code, 400)
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.assertEqual(self.login().status_code, 400)

    def test_private_api_requires_authentication(self):
        for path in ("/api/auth/me/", "/api/companies/", "/api/projects/", "/api/checklist-items/"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

    def test_logout_revokes_refresh_and_inactive_accounts_cannot_refresh(self):
        tokens = self.login().data
        self.assertEqual(self.client.post("/api/auth/logout/", {"refresh": tokens["refresh"]}).status_code, 204)
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}).status_code, 401)
        tokens = self.login().data
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}).status_code, 401)

    def test_admin_password_policy_and_deactivation_preserve_user(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/users/", {"username": "new", "password": "12345678"}).status_code, 400)
        other = get_user_model().objects.create_user(username="other")
        self.assertEqual(self.client.delete(f"/api/users/{other.pk}/").status_code, 204)
        other.refresh_from_db()
        self.assertFalse(other.is_active)

    def test_django_admin_cannot_bypass_business_closures_or_delete_records(self):
        from django.contrib import admin
        from django.test import RequestFactory
        from apps.implementation.models import ImplementationChecklistItem
        from apps.documents.models import Document
        from apps.action_plans.models import Evidence
        from apps.reviews.models import DocumentReview
        request = RequestFactory().get("/admin/")
        request.user = self.user
        for model in (ImplementationChecklistItem, Document, Evidence, DocumentReview):
            with self.subTest(model=model.__name__):
                configured = admin.site._registry[model]
                self.assertFalse(configured.has_change_permission(request))
                self.assertFalse(configured.has_delete_permission(request))

    def test_user_administration_requires_staff_and_cannot_elevate_self(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.login().data['access']}")
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/users/{self.user.pk}/", {"is_staff": True}).status_code, 403)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.assertEqual(self.client.get("/api/users/").status_code, 200)


class AccountCompanySetupTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(username="admin-qa", is_staff=True)
        self.company = Company.objects.create(name="Client A", ruc="QA-CLIENT-A", created_by=self.admin)
        self.client.force_authenticate(self.admin)

    def payload(self, **extra):
        return {"username": "new-consultant", "password": "QA-distinct-passphrase-742!", **extra}

    def test_create_account_with_first_company_access(self):
        response = self.client.post("/api/users/", self.payload(company=self.company.pk, role=CompanyRole.IMPLEMENTER), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        user = get_user_model().objects.get(username="new-consultant")
        self.assertEqual(response.data["id"], user.pk)
        self.assertTrue(user.check_password("QA-distinct-passphrase-742!"))
        self.assertFalse(user.is_staff)
        self.assertTrue(CompanyMembership.objects.filter(user=user, company=self.company, role=CompanyRole.IMPLEMENTER, is_active=True).exists())
        self.assertNotIn("password", response.data)

    def test_invalid_or_archived_company_does_not_create_account(self):
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        for company_id in (self.company.pk, self.company.pk + 10000):
            response = self.client.post("/api/users/", self.payload(company=company_id, role=CompanyRole.READER), format="json")
            self.assertEqual(response.status_code, 400, response.data)
            self.assertFalse(get_user_model().objects.filter(username="new-consultant").exists())

    def test_membership_failure_rolls_back_account(self):
        from apps.accounts.serializers import UserCreateSerializer
        serializer = UserCreateSerializer(data=self.payload(company=self.company.pk, role=CompanyRole.READER))
        serializer.is_valid(raise_exception=True)
        with patch("apps.accounts.serializers.CompanyMembership.objects.create", side_effect=RuntimeError("QA assignment failure")):
            with self.assertRaises(RuntimeError):
                serializer.save()
        self.assertFalse(get_user_model().objects.filter(username="new-consultant").exists())

    def test_account_role_requires_company_and_global_admin_has_no_company_role(self):
        for payload in (
            self.payload(role=CompanyRole.MANAGER),
            self.payload(company=self.company.pk, role=CompanyRole.MANAGER, is_staff=True),
        ):
            response = self.client.post("/api/users/", payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(get_user_model().objects.filter(username="new-consultant").exists())
        response = self.client.post("/api/users/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_non_admin_cannot_create_accounts_or_grant_global_access(self):
        for role in CompanyRole.values:
            user = get_user_model().objects.create_user(username=f"member-{role}")
            CompanyMembership.objects.create(company=self.company, user=user, role=role)
            self.client.force_authenticate(user)
            response = self.client.post("/api/users/", self.payload(company=self.company.pk, role=role, is_staff=True), format="json")
            self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(get_user_model().objects.filter(username="new-consultant").exists())
