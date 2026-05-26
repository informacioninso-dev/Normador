from django.utils import timezone

from apps.action_plans.models import ActionPlan, Evidence
from apps.common.choices import (
    ActionPlanStatus,
    EvidenceValidationStatus,
    FindingStatus,
    RequirementEvaluationStatus,
)
from apps.implementation.services import (
    recalculate_checklist_item_state,
    resolve_project_checklist_item,
)
from apps.reviews.models import Finding, RequirementEvaluation


TERMINAL_ACTION_PLAN_STATUSES = {
    ActionPlanStatus.CLOSED,
    ActionPlanStatus.SUPERSEDED,
}


def supersede_review_generated_gaps(
    *,
    project,
    requirement_ids: list[int],
    exclude_review_id: int | None = None,
) -> None:
    valid_requirement_ids = [value for value in requirement_ids if value]
    if not valid_requirement_ids:
        return

    finding_queryset = Finding.objects.filter(
        project=project,
        requirement_id__in=valid_requirement_ids,
    ).exclude(status=FindingStatus.CLOSED)
    if exclude_review_id is not None:
        finding_queryset = finding_queryset.exclude(document_review_id=exclude_review_id)
    finding_queryset.update(status=FindingStatus.CLOSED)

    action_plan_queryset = ActionPlan.objects.filter(
        project=project,
        requirement_id__in=valid_requirement_ids,
        is_auto_generated=True,
    ).exclude(status__in=TERMINAL_ACTION_PLAN_STATUSES)
    if exclude_review_id is not None:
        action_plan_queryset = action_plan_queryset.exclude(finding__document_review_id=exclude_review_id)

    now = timezone.now()
    for action_plan in action_plan_queryset:
        action_plan.status = ActionPlanStatus.SUPERSEDED
        action_plan.closed_at = now
        if not action_plan.completion_notes:
            action_plan.completion_notes = (
                "Supercedido automaticamente por una revision mas reciente."
            )
        action_plan.save(update_fields=["status", "closed_at", "completion_notes"])


def ensure_action_plans_for_findings(findings: list[Finding], created_by=None) -> list[ActionPlan]:
    created_plans = []
    for finding in findings:
        if ActionPlan.objects.filter(finding=finding).exists():
            continue

        checklist_item = resolve_project_checklist_item(finding.project, finding.requirement_id)
        clause = checklist_item.requirement.clause if checklist_item else f"hallazgo-{finding.id}"
        plan = ActionPlan.objects.create(
            project=finding.project,
            finding=finding,
            requirement=finding.requirement,
            checklist_item=checklist_item,
            title=f"Plan de accion {clause}",
            description=finding.description,
            recommended_action=finding.recommended_action,
            risk_level=finding.risk_level,
            status=ActionPlanStatus.PENDING,
            is_auto_generated=True,
            created_by=created_by,
        )
        created_plans.append(plan)

    return created_plans


def start_action_plan(action_plan: ActionPlan) -> ActionPlan:
    if action_plan.status in TERMINAL_ACTION_PLAN_STATUSES:
        raise ValueError("Action plan is already in a terminal status.")

    action_plan.status = ActionPlanStatus.IN_PROGRESS
    action_plan.save(update_fields=["status"])
    _sync_finding_status(action_plan)
    _recalculate_from_action_plan(action_plan)
    return action_plan


def resolve_action_plan(action_plan: ActionPlan, completion_notes: str = "") -> ActionPlan:
    if action_plan.status in TERMINAL_ACTION_PLAN_STATUSES:
        raise ValueError("Action plan is already in a terminal status.")

    action_plan.status = ActionPlanStatus.RESOLVED
    action_plan.resolved_at = timezone.now()
    if completion_notes:
        action_plan.completion_notes = completion_notes
    action_plan.save(update_fields=["status", "resolved_at", "completion_notes"])
    _sync_finding_status(action_plan)
    _recalculate_from_action_plan(action_plan)
    return action_plan


def close_action_plan(action_plan: ActionPlan, completion_notes: str = "") -> ActionPlan:
    if action_plan.status in TERMINAL_ACTION_PLAN_STATUSES:
        raise ValueError("Action plan is already in a terminal status.")

    _validate_action_plan_can_close(action_plan)

    now = timezone.now()
    action_plan.status = ActionPlanStatus.CLOSED
    if not action_plan.resolved_at:
        action_plan.resolved_at = now
    action_plan.closed_at = now
    if completion_notes:
        action_plan.completion_notes = completion_notes
    action_plan.save(
        update_fields=[
            "status",
            "resolved_at",
            "closed_at",
            "completion_notes",
        ]
    )
    _sync_finding_status(action_plan)
    _recalculate_from_action_plan(action_plan)
    return action_plan


def validate_evidence_record(
    evidence: Evidence,
    *,
    validated_by=None,
    validation_notes: str = "",
) -> Evidence:
    evidence.status = EvidenceValidationStatus.VALIDATED
    evidence.validated_by = validated_by
    evidence.validated_at = timezone.now()
    evidence.validation_notes = validation_notes
    evidence.save(
        update_fields=[
            "status",
            "validated_by",
            "validated_at",
            "validation_notes",
        ]
    )
    _recalculate_from_evidence(evidence)
    return evidence


def reject_evidence_record(
    evidence: Evidence,
    *,
    validated_by=None,
    validation_notes: str = "",
) -> Evidence:
    evidence.status = EvidenceValidationStatus.REJECTED
    evidence.validated_by = validated_by
    evidence.validated_at = timezone.now()
    evidence.validation_notes = validation_notes
    evidence.save(
        update_fields=[
            "status",
            "validated_by",
            "validated_at",
            "validation_notes",
        ]
    )
    _recalculate_from_evidence(evidence)
    return evidence


def _validate_action_plan_can_close(action_plan: ActionPlan) -> None:
    latest_evaluation = (
        RequirementEvaluation.objects.filter(
            document_review__project_id=action_plan.project_id,
            requirement_id=action_plan.requirement_id,
        )
        .order_by("-document_review__created_at", "-document_review_id", "-id")
        .first()
    )
    if latest_evaluation is None:
        raise ValueError("Action plan cannot be closed without a completed review.")

    if latest_evaluation.status not in {
        RequirementEvaluationStatus.COMPLIES,
        RequirementEvaluationStatus.NOT_APPLICABLE,
    }:
        raise ValueError(
            "Action plan can only be closed after the latest review indicates compliance."
        )

    requires_real_evidence = (
        action_plan.requirement.requires_real_evidence
        if action_plan.requirement_id
        else latest_evaluation.requires_real_evidence
    ) or latest_evaluation.requires_real_evidence
    if requires_real_evidence:
        validated_evidence_exists = Evidence.objects.filter(
            project_id=action_plan.project_id,
            requirement_id=action_plan.requirement_id,
            status=EvidenceValidationStatus.VALIDATED,
        ).exists()
        if not validated_evidence_exists:
            raise ValueError(
                "Validated real evidence is required before closing this action plan."
            )


def _sync_finding_status(action_plan: ActionPlan) -> None:
    if action_plan.finding_id is None:
        return

    if action_plan.status == ActionPlanStatus.PENDING:
        next_status = FindingStatus.OPEN
    elif action_plan.status in {ActionPlanStatus.IN_PROGRESS, ActionPlanStatus.RESOLVED}:
        next_status = FindingStatus.IN_PROGRESS
    else:
        next_status = FindingStatus.CLOSED

    if action_plan.finding.status != next_status:
        action_plan.finding.status = next_status
        action_plan.finding.save(update_fields=["status"])


def _recalculate_from_action_plan(action_plan: ActionPlan) -> None:
    checklist_item = action_plan.checklist_item or resolve_project_checklist_item(
        action_plan.project,
        action_plan.requirement_id,
    )
    if checklist_item is not None:
        recalculate_checklist_item_state(checklist_item)


def _recalculate_from_evidence(evidence: Evidence) -> None:
    checklist_item = evidence.checklist_item or resolve_project_checklist_item(
        evidence.project,
        evidence.requirement_id,
    )
    if checklist_item is not None:
        recalculate_checklist_item_state(checklist_item)
