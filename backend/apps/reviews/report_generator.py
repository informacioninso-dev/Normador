from collections import defaultdict

from apps.common.choices import ChecklistStatus


DOCUMENTARY_DONE_STATUSES = {
    ChecklistStatus.DOCUMENT_VALIDATED,
    ChecklistStatus.IMPLEMENTED,
    ChecklistStatus.CLOSED,
}
IMPLEMENTATION_DONE_STATUSES = {
    ChecklistStatus.IMPLEMENTED,
    ChecklistStatus.CLOSED,
}


def generate_project_progress_report(project) -> dict:
    checklist_items = list(
        project.checklist_items.select_related("requirement").order_by(
            "requirement__sequence",
            "requirement__clause",
            "id",
        )
    )
    documents = list(project.documents.order_by("-uploaded_at", "-id"))
    reviews = list(
        project.document_reviews.select_related("document", "standard").order_by(
            "-created_at",
            "-id",
        )
    )
    findings = list(project.findings.select_related("requirement").order_by("-created_at", "-id"))
    action_plans = list(
        project.action_plans.select_related("requirement", "finding").order_by(
            "status",
            "due_date",
            "-created_at",
        )
    )
    evidences = list(
        project.evidences.select_related("requirement", "action_plan").order_by(
            "-uploaded_at",
            "-id",
        )
    )

    open_findings = [finding for finding in findings if finding.status != "CERRADO"]
    open_action_plans = [
        plan for plan in action_plans if plan.status not in {"CERRADO", "SUPERSEDIDO"}
    ]
    validated_evidences = [evidence for evidence in evidences if evidence.status == "VALIDADA"]

    report = {
        "project": {
            "id": project.id,
            "name": project.name,
            "company_name": project.company.name,
            "standard_name": project.standard.name,
            "status": project.status,
            "scope": project.scope,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "target_date": project.target_date.isoformat() if project.target_date else None,
        },
        "summary": {
            "total_requirements": len(checklist_items),
            "closed_requirements": sum(
                1 for item in checklist_items if item.status == ChecklistStatus.CLOSED
            ),
            "documentary_validated_requirements": sum(
                1 for item in checklist_items if item.status in DOCUMENTARY_DONE_STATUSES
            ),
            "implemented_requirements": sum(
                1 for item in checklist_items if item.status in IMPLEMENTATION_DONE_STATUSES
            ),
            "observed_requirements": sum(
                1 for item in checklist_items if item.status == ChecklistStatus.OBSERVED
            ),
            "partial_requirements": sum(
                1 for item in checklist_items if item.status == ChecklistStatus.PARTIAL
            ),
            "not_started_requirements": sum(
                1 for item in checklist_items if item.status == ChecklistStatus.NOT_STARTED
            ),
            "documentary_progress_percentage": _compute_documentary_progress(checklist_items),
            "implementation_progress_percentage": _compute_implementation_progress(
                checklist_items
            ),
            "documents_count": len(documents),
            "reviews_count": len(reviews),
            "open_findings_count": len(open_findings),
            "open_action_plans_count": len(open_action_plans),
            "validated_evidence_count": len(validated_evidences),
        },
        "process_areas": _build_process_area_summary(checklist_items),
        "latest_reviews": [
            {
                "id": review.id,
                "document_title": review.document.title,
                "review_type": review.review_type,
                "overall_status": review.overall_status,
                "risk_level": review.risk_level,
                "summary": review.summary,
                "created_at": review.created_at.isoformat(),
            }
            for review in reviews[:5]
        ],
        "top_open_action_plans": [
            {
                "id": plan.id,
                "title": plan.title,
                "status": plan.status,
                "risk_level": plan.risk_level,
                "requirement_clause": plan.requirement.clause if plan.requirement else "",
                "requirement_title": plan.requirement.title if plan.requirement else "",
                "recommended_action": plan.recommended_action,
                "due_date": plan.due_date.isoformat() if plan.due_date else None,
            }
            for plan in open_action_plans[:5]
        ],
        "recommendations": _build_recommendations(
            checklist_items=checklist_items,
            documents=documents,
            reviews=reviews,
            open_findings=open_findings,
            open_action_plans=open_action_plans,
            validated_evidences=validated_evidences,
        ),
    }
    return report


def _compute_documentary_progress(checklist_items) -> int:
    if not checklist_items:
        return 0

    score = 0
    for item in checklist_items:
        if item.status in DOCUMENTARY_DONE_STATUSES:
            score += 100
        else:
            score += item.progress_percentage
    return round(score / len(checklist_items))


def _compute_implementation_progress(checklist_items) -> int:
    if not checklist_items:
        return 0

    score = 0
    for item in checklist_items:
        if item.requirement.requires_real_evidence:
            if item.status == ChecklistStatus.CLOSED:
                score += 100
            elif item.status == ChecklistStatus.IMPLEMENTED:
                score += 90
            elif item.status == ChecklistStatus.DOCUMENT_VALIDATED:
                score += 55
            else:
                score += min(item.progress_percentage, 50)
        else:
            score += item.progress_percentage
    return round(score / len(checklist_items))


def _build_process_area_summary(checklist_items) -> list[dict]:
    grouped = defaultdict(list)
    for item in checklist_items:
        grouped[item.requirement.process_area or "General"].append(item)

    summary = []
    for process_area, items in grouped.items():
        summary.append(
            {
                "process_area": process_area,
                "total_requirements": len(items),
                "closed_requirements": sum(
                    1 for item in items if item.status == ChecklistStatus.CLOSED
                ),
                "implemented_requirements": sum(
                    1 for item in items if item.status in IMPLEMENTATION_DONE_STATUSES
                ),
                "open_requirements": sum(
                    1 for item in items if item.status != ChecklistStatus.CLOSED
                ),
                "observed_requirements": sum(
                    1 for item in items if item.status == ChecklistStatus.OBSERVED
                ),
                "documentary_progress_percentage": _compute_documentary_progress(items),
                "implementation_progress_percentage": _compute_implementation_progress(items),
            }
        )
    return sorted(summary, key=lambda item: (-item["open_requirements"], item["process_area"]))


def _build_recommendations(
    *,
    checklist_items,
    documents,
    reviews,
    open_findings,
    open_action_plans,
    validated_evidences,
) -> list[str]:
    recommendations = []

    observed_requirements = [
        item for item in checklist_items if item.status == ChecklistStatus.OBSERVED
    ]
    documentary_only = [
        item for item in checklist_items if item.status == ChecklistStatus.DOCUMENT_VALIDATED
    ]
    review_gap = [document for document in documents if not document.reviews.exists()]

    if observed_requirements:
        recommendations.append(
            f"Priorizar la correccion documental de {len(observed_requirements)} requisito(s) observado(s)."
        )
    if documentary_only:
        recommendations.append(
            f"Convertir {len(documentary_only)} requisito(s) desde validacion documental a evidencia real validada."
        )
    if open_action_plans:
        recommendations.append(
            f"Cerrar o resolver {len(open_action_plans)} plan(es) de accion abiertos antes del piloto."
        )
    if open_findings:
        recommendations.append(
            f"Reducir los {len(open_findings)} hallazgo(s) abiertos para mejorar defendibilidad ante auditoria."
        )
    if review_gap:
        recommendations.append(
            f"Ejecutar revision sobre {len(review_gap)} documento(s) listos que aun no tienen evaluacion IA."
        )
    if reviews and not validated_evidences:
        recommendations.append(
            "Subir y validar al menos una evidencia real para demostrar la separacion entre soporte documental e implementacion."
        )
    if not recommendations:
        recommendations.append(
            "El proyecto no presenta bloqueadores visibles; el siguiente paso es mantener evidencia y vigencia documental para el piloto."
        )

    return recommendations
