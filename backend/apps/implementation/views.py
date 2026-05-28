from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from apps.common.choices import WorklogStatus
from apps.implementation.models import ImplementationChecklistItem, Project
from apps.reviews.report_generator import generate_project_progress_report
from apps.implementation.serializers import (
    ImplementationChecklistItemSerializer,
    ProjectSerializer,
    WorkLogApprovalSerializer,
    WorkLogEntryCreateSerializer,
    WorkLogEntrySerializer,
    WorkLogEntryUpdateSerializer,
)
from apps.implementation.services import generate_checklist_for_project
from apps.implementation.models import WorkLogEntry


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


class WorkLogEntryViewSet(viewsets.ModelViewSet):
    serializer_class = WorkLogEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = WorkLogEntry.objects.select_related(
            "project",
            "action_plan",
            "consultant",
            "approved_by",
            "created_by",
        )
        if not user.is_staff:
            queryset = queryset.filter(
                Q(consultant=user) | Q(project__company__created_by=user)
            ).distinct()
        project_id = self.request.query_params.get("project")
        consultant_id = self.request.query_params.get("consultant")
        status_code = self.request.query_params.get("status")
        work_date = self.request.query_params.get("work_date")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if consultant_id:
            queryset = queryset.filter(consultant_id=consultant_id)
        if status_code:
            queryset = queryset.filter(status=status_code)
        if work_date:
            queryset = queryset.filter(work_date=work_date)

        return queryset.order_by("-work_date", "-created_at", "-id")

    def get_serializer_class(self):
        if self.action == "create":
            return WorkLogEntryCreateSerializer
        if self.action in {"update", "partial_update"}:
            return WorkLogEntryUpdateSerializer
        if self.action in {"approve", "observe"}:
            return WorkLogApprovalSerializer
        return WorkLogEntrySerializer

    def perform_create(self, serializer):
        serializer.save(
            consultant=self.request.user,
            created_by=self.request.user,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        worklog = serializer.save(
            consultant=request.user,
            created_by=request.user,
        )
        read_serializer = WorkLogEntrySerializer(
            worklog,
            context=self.get_serializer_context(),
        )
        return Response(read_serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        worklog = serializer.save()
        read_serializer = WorkLogEntrySerializer(
            worklog,
            context=self.get_serializer_context(),
        )
        return Response(read_serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        worklog = self.get_object()
        approved_hours = serializer.validated_data.get("approved_hours")
        if approved_hours is None:
            approved_hours = worklog.billable_hours or worklog.logged_hours
        worklog.approved_hours = approved_hours
        worklog.review_notes = serializer.validated_data.get("review_notes", "")
        worklog.status = WorklogStatus.APPROVED
        worklog.approved_by = request.user
        worklog.approved_at = timezone.now()
        worklog.save(
            update_fields=[
                "approved_hours",
                "review_notes",
                "status",
                "approved_by",
                "approved_at",
            ]
        )
        return Response(WorkLogEntrySerializer(worklog).data)

    @action(detail=True, methods=["post"])
    def observe(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        worklog = self.get_object()
        worklog.status = WorklogStatus.OBSERVED
        worklog.review_notes = serializer.validated_data.get("review_notes", "")
        worklog.approved_by = request.user
        worklog.approved_at = timezone.now()
        worklog.save(
            update_fields=[
                "status",
                "review_notes",
                "approved_by",
                "approved_at",
            ]
        )
        return Response(WorkLogEntrySerializer(worklog).data)
