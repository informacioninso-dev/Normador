from rest_framework import viewsets, mixins
from rest_framework.response import Response
from django.db import transaction
from rest_framework.permissions import IsAuthenticated

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
