from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from apps.companies.models import Company
from apps.companies.serializers import CompanySerializer


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Company.objects.all().order_by("name")
        return Company.objects.filter(created_by=user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
