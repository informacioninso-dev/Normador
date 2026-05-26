from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from apps.standards.models import Standard, StandardRequirement
from apps.standards.serializers import StandardRequirementSerializer, StandardSerializer


class StandardViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StandardSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Standard.objects.filter(is_active=True).annotate(
            requirement_count=Count("requirements")
        )


class StandardRequirementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StandardRequirementSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = StandardRequirement.objects.select_related("standard").all()
        standard_id = self.request.query_params.get("standard")
        code = self.request.query_params.get("standard_code")
        process_area = self.request.query_params.get("process_area")

        if standard_id:
            queryset = queryset.filter(standard_id=standard_id)
        if code:
            queryset = queryset.filter(standard__code=code)
        if process_area:
            queryset = queryset.filter(process_area__iexact=process_area)

        return queryset.order_by("standard__name", "sequence", "clause", "id")
