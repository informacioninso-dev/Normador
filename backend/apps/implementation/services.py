from apps.common.choices import ChecklistStatus, DocumentProcessingStatus, RequirementEvaluationStatus
from apps.implementation.models import ImplementationChecklistItem, Project


CHECKLIST_PROGRESS_BY_STATUS = {
    ChecklistStatus.NOT_STARTED: 0,
    ChecklistStatus.DOCUMENT_PENDING: 5,
    ChecklistStatus.IN_REVIEW: 10,
    ChecklistStatus.OBSERVED: 25,
    ChecklistStatus.PARTIAL: 50,
    ChecklistStatus.DOCUMENT_VALIDATED: 80,
    ChecklistStatus.IMPLEMENTED: 90,
    ChecklistStatus.CLOSED: 100,
}


def generate_checklist_for_project(project: Project, overwrite: bool = False) -> int:
    requirements = project.standard.requirements.all().order_by("sequence", "clause", "id")
    if overwrite:
        project.checklist_items.all().delete()

    created = 0
    existing_requirement_ids = set(
        project.checklist_items.values_list("requirement_id", flat=True)
    )
    new_items = []

    for requirement in requirements:
        if requirement.id in existing_requirement_ids:
            continue

        new_items.append(
            ImplementationChecklistItem(
                project=project,
                requirement=requirement,
                title=requirement.title,
                description=requirement.requirement_text,
                status=ChecklistStatus.NOT_STARTED,
                progress_percentage=0,
                required_document_type=requirement.required_document_type,
                required_evidence_type=requirement.required_evidence_type,
            )
        )

    if new_items:
        ImplementationChecklistItem.objects.bulk_create(new_items)
        created = len(new_items)

    return created


def resolve_project_checklist_item(
    project: Project,
    requirement_id: int | None,
) -> ImplementationChecklistItem | None:
    if requirement_id is None:
        return None
    return project.checklist_items.filter(requirement_id=requirement_id).first()


def recalculate_checklist_item_state(
    checklist_item: ImplementationChecklistItem,
) -> ImplementationChecklistItem:
    from apps.action_plans.models import ActionPlan, Evidence
    from apps.common.choices import ActionPlanStatus, EvidenceValidationStatus
    from apps.reviews.models import RequirementEvaluation

    latest_evaluation = (
        RequirementEvaluation.objects.filter(
            document_review__project_id=checklist_item.project_id,
            requirement_id=checklist_item.requirement_id,
        )
        .select_related("document_review")
        .order_by("-document_review__created_at", "-document_review_id", "-id")
        .first()
    )
    has_ready_documents = checklist_item.project.documents.filter(
        requirement_id=checklist_item.requirement_id,
        status=DocumentProcessingStatus.READY,
    ).exists()
    validated_evidence_exists = Evidence.objects.filter(
        project_id=checklist_item.project_id,
        requirement_id=checklist_item.requirement_id,
        status=EvidenceValidationStatus.VALIDATED,
    ).exists()
    open_action_plans_exist = ActionPlan.objects.filter(
        project_id=checklist_item.project_id,
        requirement_id=checklist_item.requirement_id,
    ).exclude(
        status__in=[
            ActionPlanStatus.CLOSED,
            ActionPlanStatus.SUPERSEDED,
        ]
    ).exists()

    next_status = checklist_item.status
    next_progress = checklist_item.progress_percentage
    next_is_not_applicable = False

    if checklist_item.is_not_applicable and (
        latest_evaluation is None
        or latest_evaluation.status == RequirementEvaluationStatus.NOT_APPLICABLE
    ):
        next_status = ChecklistStatus.CLOSED
        next_progress = CHECKLIST_PROGRESS_BY_STATUS[ChecklistStatus.CLOSED]
        next_is_not_applicable = True
    elif latest_evaluation is None:
        next_status = ChecklistStatus.IN_REVIEW if has_ready_documents else ChecklistStatus.NOT_STARTED
    else:
        evaluation_status = latest_evaluation.status
        if evaluation_status == RequirementEvaluationStatus.DOES_NOT_COMPLY:
            next_status = ChecklistStatus.OBSERVED
        elif evaluation_status == RequirementEvaluationStatus.PARTIAL:
            next_status = ChecklistStatus.PARTIAL
        elif evaluation_status == RequirementEvaluationStatus.NOT_APPLICABLE:
            next_status = ChecklistStatus.CLOSED
            next_is_not_applicable = True
        elif evaluation_status == RequirementEvaluationStatus.COMPLIES:
            requires_real_evidence = (
                checklist_item.requirement.requires_real_evidence
                or latest_evaluation.requires_real_evidence
            )
            if requires_real_evidence:
                if not validated_evidence_exists:
                    next_status = ChecklistStatus.DOCUMENT_VALIDATED
                elif open_action_plans_exist:
                    next_status = ChecklistStatus.IMPLEMENTED
                else:
                    next_status = ChecklistStatus.CLOSED
            elif open_action_plans_exist:
                next_status = ChecklistStatus.DOCUMENT_VALIDATED
            else:
                next_status = ChecklistStatus.CLOSED
        else:
            next_status = ChecklistStatus.IN_REVIEW if has_ready_documents else ChecklistStatus.DOCUMENT_PENDING

    next_progress = CHECKLIST_PROGRESS_BY_STATUS[next_status]

    changed_fields = []
    if checklist_item.status != next_status:
        checklist_item.status = next_status
        changed_fields.append("status")
    if checklist_item.progress_percentage != next_progress:
        checklist_item.progress_percentage = next_progress
        changed_fields.append("progress_percentage")
    if checklist_item.is_not_applicable != next_is_not_applicable:
        checklist_item.is_not_applicable = next_is_not_applicable
        changed_fields.append("is_not_applicable")
    if next_is_not_applicable and checklist_item.not_applicable_justification == "":
        checklist_item.not_applicable_justification = "Marcado automaticamente por revision como no aplica."
        changed_fields.append("not_applicable_justification")

    if changed_fields:
        checklist_item.save(update_fields=changed_fields)

    return checklist_item
