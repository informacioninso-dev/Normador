from io import BytesIO

from django.db import transaction
from django.utils import timezone
from openpyxl import Workbook

from apps.action_plans.models import ActionPlan, Evidence
from apps.companies.branding import snapshot_branding
from apps.documents.models import Document
from apps.documents.presentation import add_excel_header
from apps.reviews.models import DocumentReview, RequirementEvaluation
from apps.reviews.report_generator import generate_project_progress_report


def _date(value):
    return value.isoformat() if value else ""


def _user(value):
    return value.get_username() if value else "Sin asignar"


@transaction.atomic
def export_project_workbook(project):
    report = generate_project_progress_report(project)
    branding = snapshot_branding(project.company)
    metadata = {"Empresa": project.company.name, "RUC": project.company.ruc,
                "Proyecto": project.name, "Norma": project.standard.name,
                "Fecha": timezone.localtime().strftime("%Y-%m-%d %H:%M %Z")}
    workbook = Workbook()
    workbook.remove(workbook.active)
    def sheet(name, columns, rows):
        add_excel_header(workbook.create_sheet(name), name, metadata, branding, columns, rows)
    summary = report["summary"]
    sheet("Resumen", ["Indicador", "Valor"], [
        ["Avance documental (%)", summary["documentary_progress_percentage"]],
        ["Implementación real (%)", summary["implementation_progress_percentage"]],
        ["Requisitos cerrados", summary["closed_requirements"]],
        ["Total de requisitos", summary["total_requirements"]],
        ["Revisiones simuladas presentes", "Sí" if summary["has_simulated_reviews"] else "No"],
        ["Alcance", project.scope],
        ["Criterio", "Los documentos y la evidencia validada se contabilizan por separado. El estado es el registrado en el sistema."],
    ])
    documents = list(Document.objects.filter(project=project).select_related("requirement", "checklist_item"))
    evidences = list(Evidence.objects.filter(project=project).select_related("requirement", "validated_by"))
    plans = list(ActionPlan.objects.filter(project=project).select_related("requirement", "owner"))
    evaluations = list(RequirementEvaluation.objects.filter(document_review__project=project)
                       .exclude(document_review__document__status="ARCHIVADO")
                       .select_related("document_review", "requirement").order_by("-document_review__created_at", "-id"))
    latest = {}
    for evaluation in evaluations:
        latest.setdefault(evaluation.requirement_id, evaluation)
    matrix = []
    for item in project.checklist_items.select_related("requirement", "assigned_to").order_by("requirement__sequence", "id"):
        req = item.requirement
        docs = [d for d in documents if d.status != "ARCHIVADO" and (d.requirement_id == req.id or d.checklist_item_id == item.id)]
        evidence = [e for e in evidences if e.requirement_id == req.id or e.checklist_item_id == item.id]
        actions = [p for p in plans if (p.requirement_id == req.id or p.checklist_item_id == item.id) and p.status not in {"CERRADO", "SUPERSEDIDO"}]
        evaluation = latest.get(req.id)
        matrix.append([req.clause, req.process_area, req.title, item.get_status_display(),
                       len(docs), evaluation.get_status_display() if evaluation else "Sin revisión",
                       sum(e.status == "VALIDADA" for e in evidence), len(evidence), len(actions),
                       _user(item.assigned_to), _date(item.due_date),
                       "; ".join(f"#{d.id} {d.title}" for d in docs),
                       "Sí" if req.requires_real_evidence else "No"])
    sheet("Matriz de requisitos", ["Cláusula", "Proceso", "Requisito", "Estado", "Documentos", "Última evaluación",
          "Evidencias validadas", "Evidencias totales", "Acciones abiertas", "Responsable", "Fecha prevista", "Referencias documentales", "Exige evidencia real"], matrix)
    sheet("Acciones", ["ID", "Cláusula", "Acción", "Estado", "Riesgo", "Responsable", "Fecha prevista", "Descripción", "Recomendación"],
          [[p.id, p.requirement.clause if p.requirement else "", p.title, p.get_status_display(), p.risk_level,
            _user(p.owner), _date(p.due_date), p.description, p.recommended_action] for p in plans])
    sheet("Evidencias", ["ID", "Cláusula", "Evidencia", "Tipo", "Estado", "Fecha del hecho", "Validada por", "Fecha de validación", "Notas de validación"],
          [[e.id, e.requirement.clause if e.requirement else "", e.title, e.get_evidence_type_display(), e.get_status_display(),
            _date(e.occurred_on), _user(e.validated_by), _date(e.validated_at), e.validation_notes] for e in evidences])
    sheet("Documentos", ["ID", "Cláusula", "Documento", "Tipo", "Estado", "Archivo", "Fecha de carga"],
          [[d.id, d.requirement.clause if d.requirement else "", d.title, d.get_document_type_display(), d.get_status_display(),
            d.file_name, _date(d.uploaded_at)] for d in documents])
    reviews = DocumentReview.objects.filter(project=project).select_related("document", "created_by")
    sheet("Revisiones", ["ID", "Documento", "Resultado", "Riesgo", "Proveedor", "Modelo", "Prompt", "Usuario", "Fecha", "Resumen"],
          [[r.id, r.document.title, r.overall_status, r.risk_level, r.provider, r.ai_model_used, r.prompt_version,
            _user(r.created_by), _date(r.created_at), r.summary] for r in reviews])
    sheet("Evaluaciones", ["Revisión", "Cláusula", "Resultado", "Evidencia citada", "Brecha", "Recomendación", "Faltantes"],
          [[e.document_review_id, e.requirement.clause, e.status, e.evidence_found, e.gap, e.recommendation,
            "; ".join(e.missing_documents_or_evidence)] for e in evaluations])
    workbook.properties.title = f"Informe de avance - {project.name}"
    workbook.properties.creator = "NORMAN"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
