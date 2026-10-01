from apps.common.choices import (
    ChecklistItemType,
    ChecklistStatus,
    DocumentProcessingStatus,
    DocumentType,
    EvidenceType,
    RequirementEvaluationStatus,
)
from apps.implementation.models import ImplementationChecklistItem, Project
from apps.standards.library_extractor import LibrarySyncResult, sync_standard_requirements_from_reference_library


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


def generate_checklist_for_project(
    project: Project,
    overwrite: bool = False,
    use_library: bool = False,
) -> int:
    if use_library:
        sync_standard_requirements_from_reference_library(project.standard)

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

        payload = build_operational_checklist_payload(requirement)
        new_items.append(
            ImplementationChecklistItem(
                project=project,
                requirement=requirement,
                title=payload["title"],
                description=payload["description"],
                item_type=payload["item_type"],
                implementation_task=payload["implementation_task"],
                acceptance_criteria=payload["acceptance_criteria"],
                review_questions=payload["review_questions"],
                requires_document=payload["requires_document"],
                requires_evidence=payload["requires_evidence"],
                ai_review_focus=payload["ai_review_focus"],
                status=ChecklistStatus.NOT_STARTED,
                progress_percentage=0,
                required_document_type=requirement.required_document_type,
                required_evidence_type=requirement.required_evidence_type,
            )
        )

    if new_items:
        ImplementationChecklistItem.objects.bulk_create(new_items)
        created = len(new_items)

    refresh_operational_checklist_fields(project)
    return created


def regenerate_checklist_from_reference_library(
    project: Project,
    overwrite: bool = False,
) -> dict:
    sync_result: LibrarySyncResult = sync_standard_requirements_from_reference_library(
        project.standard
    )
    created_items = generate_checklist_for_project(
        project,
        overwrite=overwrite,
        use_library=False,
    )
    return {
        "created_requirements": sync_result.created_requirements,
        "reference_documents": sync_result.reference_documents,
        "extracted_clauses": sync_result.extracted_clauses,
        "created_items": created_items,
    }


def refresh_operational_checklist_fields(project: Project) -> int:
    updated = 0
    items = project.checklist_items.select_related("requirement").all()
    for item in items:
        payload = build_operational_checklist_payload(item.requirement)
        changed_fields = []
        for field, value in payload.items():
            if getattr(item, field) != value:
                setattr(item, field, value)
                changed_fields.append(field)
        if item.required_document_type != item.requirement.required_document_type:
            item.required_document_type = item.requirement.required_document_type
            changed_fields.append("required_document_type")
        if item.required_evidence_type != item.requirement.required_evidence_type:
            item.required_evidence_type = item.requirement.required_evidence_type
            changed_fields.append("required_evidence_type")
        if changed_fields:
            item.save(update_fields=changed_fields)
            updated += 1
    return updated


def build_operational_checklist_payload(requirement) -> dict:
    item_type = _infer_item_type(requirement)
    requires_document = _requires_document(requirement)
    requires_evidence = bool(requirement.requires_real_evidence or requirement.expected_evidence)
    action_verb = {
        ChecklistItemType.DOCUMENT: "Preparar y aprobar",
        ChecklistItemType.EVIDENCE: "Demostrar con evidencia",
        ChecklistItemType.ACTIVITY: "Ejecutar y registrar",
        ChecklistItemType.CONTROL: "Implementar y controlar",
        ChecklistItemType.DECISION: "Definir y aprobar",
    }.get(item_type, "Implementar")

    title = f"{action_verb} {requirement.title}".strip()
    implementation_task = _build_implementation_task(
        requirement,
        item_type=item_type,
        requires_document=requires_document,
        requires_evidence=requires_evidence,
    )
    acceptance_criteria = _build_acceptance_criteria(
        requirement,
        requires_document=requires_document,
        requires_evidence=requires_evidence,
    )
    review_questions = _build_review_questions(requirement)

    return {
        "title": title[:255],
        "description": (
            f"Obligacion operativa derivada de {requirement.standard.code} "
            f"clausula {requirement.clause}. {requirement.requirement_text}"
        ),
        "item_type": item_type,
        "implementation_task": implementation_task,
        "acceptance_criteria": acceptance_criteria,
        "review_questions": review_questions,
        "requires_document": requires_document,
        "requires_evidence": requires_evidence,
        "ai_review_focus": _build_ai_review_focus(
            requirement,
            requires_document=requires_document,
            requires_evidence=requires_evidence,
        ),
    }


def _infer_item_type(requirement) -> str:
    normalized = " ".join(
        [
            requirement.title,
            requirement.process_area,
            requirement.requirement_text,
        ]
    ).lower()
    if any(token in normalized for token in ["revision por la direccion", "politica", "alcance", "objetivo"]):
        return ChecklistItemType.DECISION
    if any(token in normalized for token in ["auditoria", "capacitacion", "competencia", "reunion"]):
        return ChecklistItemType.ACTIVITY
    if any(token in normalized for token in ["registro", "evidencia", "trazabilidad"]):
        return ChecklistItemType.EVIDENCE
    if _requires_document(requirement) and not requirement.requires_real_evidence:
        return ChecklistItemType.DOCUMENT
    return ChecklistItemType.CONTROL


def _requires_document(requirement) -> bool:
    return bool(
        requirement.expected_documents
        or requirement.required_document_type not in {"", DocumentType.OTHER}
    )


def _build_implementation_task(
    requirement,
    *,
    item_type: str,
    requires_document: bool,
    requires_evidence: bool,
) -> str:
    fragments = [
        f"Ejecutar la actividad necesaria para cumplir la clausula {requirement.clause} en el proceso {requirement.process_area}.",
        "Definir responsable, metodo, frecuencia o momento de ejecucion y registro de seguimiento.",
    ]
    if item_type == ChecklistItemType.DECISION:
        fragments.append("Formalizar la decision, aprobacion o criterio de direccion aplicable.")
    elif item_type == ChecklistItemType.ACTIVITY:
        fragments.append("Registrar la actividad realizada y los participantes o responsables involucrados.")
    elif item_type == ChecklistItemType.CONTROL:
        fragments.append("Asegurar que el control opere en campo y deje trazabilidad verificable.")
    if requires_document:
        fragments.append("Subir el documento aplicable para revision AI cuando exista politica, manual, POE, matriz o formato.")
    if requires_evidence:
        fragments.append("Subir evidencia real de ejecucion antes de intentar cerrar el requisito.")
    return " ".join(fragments)


def _build_acceptance_criteria(requirement, *, requires_document: bool, requires_evidence: bool) -> list[str]:
    criteria = [
        "La responsabilidad y el metodo de ejecucion estan definidos.",
        "El alcance del requisito es aplicable al contexto del proyecto.",
    ]
    if requires_document:
        docs = requirement.expected_documents or [_document_type_label(requirement.required_document_type)]
        criteria.append(
            "Documento requerido cargado y revisado por AI: "
            + ", ".join(filter(None, docs))
            + "."
        )
        criteria.append("La revision AI no tiene brechas documentales criticas abiertas.")
    if requires_evidence:
        evidence = requirement.expected_evidence or [_evidence_type_label(requirement.required_evidence_type)]
        criteria.append(
            "Evidencia operativa cargada y validada: "
            + ", ".join(filter(None, evidence))
            + "."
        )
    criteria.append("No existen planes de accion abiertos que bloqueen el cierre.")
    return criteria


def _build_review_questions(requirement) -> list[str]:
    questions = list(requirement.verification_questions or [])
    questions.extend(
        [
            "El documento o evidencia corresponde exactamente a esta clausula?",
            "La informacion permite verificar cumplimiento sin asumir datos no escritos?",
            "Falta evidencia operativa para diferenciar documento de implementacion real?",
        ]
    )
    return list(dict.fromkeys(questions))


def _build_ai_review_focus(requirement, *, requires_document: bool, requires_evidence: bool) -> str:
    focus = [
        f"Evaluar la clausula {requirement.clause} requisito por requisito.",
        "Validar completitud, coherencia, responsables, registros y trazabilidad.",
        "No cerrar si el documento no demuestra lo exigido por la norma y el contexto RAG.",
    ]
    if requires_document:
        focus.append("Comparar el documento contra norma, anexos normativos y contexto de empresa.")
    if requires_evidence:
        focus.append("Separar cumplimiento documental de evidencia real de implementacion.")
    return " ".join(focus)


def _document_type_label(value: str) -> str:
    labels = {
        DocumentType.POLICY: "Politica",
        DocumentType.PROCEDURE: "Procedimiento o POE",
        DocumentType.TEMPLATE: "Formato",
        DocumentType.RECORD: "Registro",
        DocumentType.MATRIX: "Matriz",
        DocumentType.REPORT: "Informe",
        DocumentType.MINUTES: "Acta",
        DocumentType.EVIDENCE: "Evidencia documental",
    }
    return labels.get(value, "")


def _evidence_type_label(value: str) -> str:
    labels = {
        EvidenceType.RECORD: "Registro diligenciado",
        EvidenceType.MINUTES: "Acta ejecutada",
        EvidenceType.REPORT: "Informe emitido",
        EvidenceType.TRAINING: "Soporte de capacitacion",
        EvidenceType.EXECUTED_CONTROL: "Control ejecutado",
        EvidenceType.AUDIT_TRAIL: "Trazabilidad verificable",
    }
    return labels.get(value, "")


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
        .exclude(document_review__document__status=DocumentProcessingStatus.ARCHIVED)
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
