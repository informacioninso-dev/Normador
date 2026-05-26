from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.action_plans.models import ActionPlan, Evidence
from apps.action_plans.serializers import (
    ActionPlanCreateSerializer,
    ActionPlanSerializer,
    ActionPlanTransitionSerializer,
    ActionPlanUpdateSerializer,
    EvidenceCreateSerializer,
    EvidenceSerializer,
    EvidenceUpdateSerializer,
    EvidenceValidationSerializer,
)
from apps.action_plans.services import (
    close_action_plan,
    reject_evidence_record,
    resolve_action_plan,
    start_action_plan,
    validate_evidence_record,
)


class ActionPlanViewSet(viewsets.ModelViewSet):
    queryset = ActionPlan.objects.none()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            ActionPlan.objects.select_related(
                "project",
                "finding",
                "requirement",
                "checklist_item",
                "owner",
                "created_by",
            )
            .annotate(
                evidence_count=Count("evidences"),
                validated_evidence_count=Count(
                    "evidences",
                    filter=Q(evidences__status="VALIDADA"),
                ),
            )
            .order_by("status", "due_date", "-created_at", "-id")
        )
        project_id = self.request.query_params.get("project")
        requirement_id = self.request.query_params.get("requirement")
        checklist_item_id = self.request.query_params.get("checklist_item")
        finding_id = self.request.query_params.get("finding")
        status_code = self.request.query_params.get("status")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        if checklist_item_id:
            queryset = queryset.filter(checklist_item_id=checklist_item_id)
        if finding_id:
            queryset = queryset.filter(finding_id=finding_id)
        if status_code:
            queryset = queryset.filter(status=status_code)

        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return ActionPlanCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ActionPlanUpdateSerializer
        if self.action in {"start_progress", "resolve", "close_plan"}:
            return ActionPlanTransitionSerializer
        return ActionPlanSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_plan = serializer.save(
            created_by=request.user if request.user.is_authenticated else None
        )
        read_serializer = ActionPlanSerializer(action_plan, context=self.get_serializer_context())
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        action_plan = serializer.save()
        read_serializer = ActionPlanSerializer(action_plan, context=self.get_serializer_context())
        return Response(read_serializer.data)

    @action(detail=True, methods=["post"])
    def start_progress(self, request, pk=None):
        action_plan = self.get_object()
        try:
            action_plan = start_action_plan(action_plan)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ActionPlanSerializer(action_plan).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_plan = self.get_object()
        try:
            action_plan = resolve_action_plan(
                action_plan,
                completion_notes=serializer.validated_data.get("completion_notes", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ActionPlanSerializer(action_plan).data)

    @action(detail=True, methods=["post"])
    def close_plan(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_plan = self.get_object()
        try:
            action_plan = close_action_plan(
                action_plan,
                completion_notes=serializer.validated_data.get("completion_notes", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ActionPlanSerializer(action_plan).data)


class EvidenceViewSet(viewsets.ModelViewSet):
    queryset = Evidence.objects.none()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Evidence.objects.select_related(
            "project",
            "action_plan",
            "finding",
            "requirement",
            "checklist_item",
            "document",
            "uploaded_by",
            "validated_by",
        )
        project_id = self.request.query_params.get("project")
        requirement_id = self.request.query_params.get("requirement")
        checklist_item_id = self.request.query_params.get("checklist_item")
        action_plan_id = self.request.query_params.get("action_plan")
        status_code = self.request.query_params.get("status")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        if checklist_item_id:
            queryset = queryset.filter(checklist_item_id=checklist_item_id)
        if action_plan_id:
            queryset = queryset.filter(action_plan_id=action_plan_id)
        if status_code:
            queryset = queryset.filter(status=status_code)

        return queryset.order_by("-uploaded_at", "-id")

    def get_serializer_class(self):
        if self.action == "create":
            return EvidenceCreateSerializer
        if self.action in {"update", "partial_update"}:
            return EvidenceUpdateSerializer
        if self.action in {"validate_evidence", "reject_evidence"}:
            return EvidenceValidationSerializer
        return EvidenceSerializer

    def perform_create(self, serializer):
        serializer.save(
            uploaded_by=self.request.user if self.request.user.is_authenticated else None
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = serializer.save(
            uploaded_by=request.user if request.user.is_authenticated else None
        )
        read_serializer = EvidenceSerializer(evidence, context=self.get_serializer_context())
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        evidence = serializer.save()
        read_serializer = EvidenceSerializer(evidence, context=self.get_serializer_context())
        return Response(read_serializer.data)

    @action(detail=True, methods=["post"])
    def validate_evidence(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = self.get_object()
        evidence = validate_evidence_record(
            evidence,
            validated_by=request.user if request.user.is_authenticated else None,
            validation_notes=serializer.validated_data.get("validation_notes", ""),
        )
        return Response(EvidenceSerializer(evidence).data)

    @action(detail=True, methods=["post"])
    def reject_evidence(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = self.get_object()
        evidence = reject_evidence_record(
            evidence,
            validated_by=request.user if request.user.is_authenticated else None,
            validation_notes=serializer.validated_data.get("validation_notes", ""),
        )
        return Response(EvidenceSerializer(evidence).data)
