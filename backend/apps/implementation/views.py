from django.db.models import Count
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from apps.implementation.models import ImplementationChecklistItem, Project
from apps.reviews.report_generator import generate_project_progress_report
from apps.implementation.serializers import (
    ImplementationChecklistItemSerializer,
    ProjectSerializer,
)
from apps.implementation.services import generate_checklist_for_project


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.select_related("company", "standard").annotate(
            checklist_items_count=Count("checklist_items")
        )
        if user.is_staff:
            return qs
        return qs.filter(company__created_by=user)

    @action(detail=True, methods=["post"])
    def regenerate_checklist(self, request, pk=None):
        project = self.get_object()
        created = generate_checklist_for_project(project, overwrite=False)
        serializer = self.get_serializer(project)
        return Response(
            {
                "project": serializer.data,
                "created_items": created,
            }
        )

    @action(detail=True, methods=["get"])
    def progress_report(self, request, pk=None):
        project = self.get_object()
        report = generate_project_progress_report(project)
        return Response(report)


class ImplementationChecklistItemViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ImplementationChecklistItemSerializer

    def get_queryset(self):
        queryset = ImplementationChecklistItem.objects.select_related(
            "project",
            "requirement",
            "project__company",
            "project__standard",
        )
        project_id = self.request.query_params.get("project")
        status_code = self.request.query_params.get("status")
        process_area = self.request.query_params.get("process_area")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if status_code:
            queryset = queryset.filter(status=status_code)
        if process_area:
            queryset = queryset.filter(requirement__process_area__iexact=process_area)

        return queryset.order_by("requirement__sequence", "requirement__clause", "id")
