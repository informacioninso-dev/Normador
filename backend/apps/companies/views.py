from rest_framework import viewsets, mixins
from rest_framework.response import Response
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.http import FileResponse

from apps.companies.models import Company, CompanyMembership, CompanyRole
from apps.companies.serializers import CompanySerializer, CompanyMembershipSerializer
from apps.companies.api_access import CompanyScopedViewMixin
from apps.companies.access import MANAGE_ROLES, require_company, scope_queryset


class CompanyViewSet(CompanyScopedViewMixin, viewsets.ModelViewSet):
    serializer_class = CompanySerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        return Company.objects.all().order_by("name")

    def perform_create(self, serializer):
        with transaction.atomic():
            company = serializer.save(created_by=self.request.user)
            CompanyMembership.objects.create(company=company, user=self.request.user, role=CompanyRole.MANAGER)

    def perform_update(self, serializer):
        require_company(self.request.user, serializer.instance.pk, MANAGE_ROLES)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        company.is_active = False
        company.save(update_fields=["is_active", "updated_at"])
        return Response(status=204)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        company = self.get_object()
        if not company.logo:
            return Response({"detail": "La empresa todavía no tiene logo."}, status=404)
        response = FileResponse(company.logo.open("rb"), content_type="image/png", filename="logo.png")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class CompanyMembershipViewSet(CompanyScopedViewMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                               mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompanyMembershipSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = scope_queryset(CompanyMembership.objects.select_related("company", "user"), self.request.user, MANAGE_ROLES)
        if company := self.request.query_params.get("company"):
            queryset = queryset.filter(company_id=company)
        return queryset
