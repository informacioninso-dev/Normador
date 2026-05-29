import json
from dataclasses import dataclass

from apps.ai_engine.models import PromptTemplate


DEFAULT_REVIEW_SYSTEM_PROMPT = """
Actua como auditor experto en sistemas de gestion ISO y regulacion sanitaria.

Debes revisar el documento proporcionado contra los requisitos seleccionados.

Reglas:
1. No inventes evidencias.
2. No asumas cumplimiento si el texto no lo demuestra.
3. Diferencia cumplimiento documental de implementacion real.
4. Evalua requisito por requisito.
5. Indica evidencia encontrada en el documento.
6. Indica brecha si falta informacion.
7. Clasifica el riesgo como BAJO, MEDIO o ALTO.
8. Indica si el requisito puede cerrarse.
9. Si no puede cerrarse, explica que documento o evidencia falta.
10. Sugiere texto concreto para corregir el documento cuando aplique.
11. Usa el item operativo del checklist para evaluar tareas, responsables, criterios y evidencia de campo.
12. Usa lenguaje formal, tecnico y auditable.
13. Responde unicamente en JSON valido.
""".strip()

REVIEW_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_status": {
            "type": "string",
            "enum": ["CUMPLE", "CUMPLE_PARCIAL", "NO_CUMPLE", "NO_APLICA"],
        },
        "risk_level": {
            "type": "string",
            "enum": ["BAJO", "MEDIO", "ALTO"],
        },
        "executive_summary": {"type": "string"},
        "requirement_evaluations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": ["integer", "string"]},
                    "status": {
                        "type": "string",
                        "enum": [
                            "CUMPLE",
                            "CUMPLE_PARCIAL",
                            "NO_CUMPLE",
                            "NO_APLICA",
                        ],
                    },
                    "evidence_found": {"type": "string"},
                    "gap": {"type": "string"},
                    "risk_level": {
                        "type": "string",
                        "enum": ["BAJO", "MEDIO", "ALTO"],
                    },
                    "recommendation": {"type": "string"},
                    "suggested_text": {"type": "string"},
                    "can_close_requirement": {"type": "boolean"},
                    "requires_real_evidence": {"type": "boolean"},
                    "missing_documents_or_evidence": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "requirement_id",
                    "status",
                    "evidence_found",
                    "gap",
                    "risk_level",
                    "recommendation",
                    "suggested_text",
                    "can_close_requirement",
                    "requires_real_evidence",
                    "missing_documents_or_evidence",
                ],
            },
        },
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": ["integer", "string", "null"]},
                    "type": {
                        "type": "string",
                        "enum": [
                            "BRECHA_DOCUMENTAL",
                            "BRECHA_IMPLEMENTACION",
                            "RIESGO_AUDITORIA",
                            "NO_CONFORMIDAD_POTENCIAL",
                            "OBSERVACION",
                            "OPORTUNIDAD_MEJORA",
                        ],
                    },
                    "description": {"type": "string"},
                    "risk_level": {
                        "type": "string",
                        "enum": ["BAJO", "MEDIO", "ALTO"],
                    },
                    "recommended_action": {"type": "string"},
                },
                "required": [
                    "type",
                    "description",
                    "risk_level",
                    "recommended_action",
                ],
            },
        },
        "implementation_pending_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {
                        "type": "string",
                        "enum": ["BAJA", "MEDIA", "ALTA"],
                    },
                    "required_document": {"type": "string"},
                    "required_evidence": {"type": "string"},
                },
                "required": [
                    "title",
                    "description",
                    "priority",
                    "required_document",
                    "required_evidence",
                ],
            },
        },
    },
    "required": [
        "overall_status",
        "risk_level",
        "executive_summary",
        "requirement_evaluations",
        "findings",
        "implementation_pending_items",
    ],
}


@dataclass
class PromptBundle:
    prompt_version: str
    system_prompt: str
    user_prompt: str
    response_schema: dict


def get_active_review_template() -> PromptTemplate | None:
    return (
        PromptTemplate.objects.filter(
            slug="document-review-v1",
            is_active=True,
        )
        .order_by("-created_at")
        .first()
    )


def build_document_review_prompt(
    *,
    document,
    standard,
    review_type: str,
    requirements: list,
    retrieved_context: dict,
) -> PromptBundle:
    template = get_active_review_template()
    system_prompt = template.system_prompt if template else DEFAULT_REVIEW_SYSTEM_PROMPT
    prompt_version = template.version if template else "builtin-document-review-v1"
    response_schema = template.response_schema if template and template.response_schema else REVIEW_OUTPUT_SCHEMA

    requirement_payload = []
    for requirement in requirements:
        checklist_item = None
        if document.project_id:
            checklist_item = (
                document.project.checklist_items.filter(requirement_id=requirement.id)
                .order_by("id")
                .first()
            )
        checklist_payload = None
        if checklist_item:
            checklist_payload = {
                "id": checklist_item.id,
                "title": checklist_item.title,
                "item_type": checklist_item.item_type,
                "implementation_task": checklist_item.implementation_task,
                "acceptance_criteria": checklist_item.acceptance_criteria,
                "review_questions": checklist_item.review_questions,
                "requires_document": checklist_item.requires_document,
                "requires_evidence": checklist_item.requires_evidence,
                "ai_review_focus": checklist_item.ai_review_focus,
                "current_status": checklist_item.status,
            }
        requirement_payload.append(
            {
                "id": requirement.id,
                "clause": requirement.clause,
                "title": requirement.title,
                "requirement_text": requirement.requirement_text,
                "process_area": requirement.process_area,
                "criticality": requirement.criticality,
                "expected_documents": requirement.expected_documents,
                "expected_evidence": requirement.expected_evidence,
                "verification_questions": requirement.verification_questions,
                "requires_real_evidence": requirement.requires_real_evidence,
                "required_document_type": requirement.required_document_type,
                "required_evidence_type": requirement.required_evidence_type,
                "operational_checklist_item": checklist_payload,
            }
        )

    # Separate project-doc chunks from reference-library chunks for the prompt
    project_context = {}
    reference_context = {}
    operational_context = {}
    for req_key, req_data in retrieved_context.items():
        project_context[req_key] = {
            "requirement_id": req_data["requirement_id"],
            "chunks": req_data.get("chunks", []),
        }
        context_chunks = req_data.get("project_context_chunks", [])
        if context_chunks:
            operational_context[req_key] = {
                "requirement_id": req_data["requirement_id"],
                "project_context_chunks": context_chunks,
            }
        ref_chunks = req_data.get("reference_chunks", [])
        if ref_chunks:
            reference_context[req_key] = {
                "requirement_id": req_data["requirement_id"],
                "reference_chunks": ref_chunks,
            }

    prompt_parts = [
        f"Documento: {document.title}",
        f"Tipo documental: {document.document_type}",
        f"Norma: {standard.name} ({standard.code})",
        f"Tipo de revision: {review_type}",
        "Requisitos a evaluar:",
        json.dumps(requirement_payload, ensure_ascii=False, indent=2),
        "Contexto recuperado del documento del cliente por requisito:",
        json.dumps(project_context, ensure_ascii=False, indent=2),
    ]
    if reference_context:
        prompt_parts += [
            "Documentos de referencia de la biblioteca (implementaciones previas y mejores practicas):",
            json.dumps(reference_context, ensure_ascii=False, indent=2),
        ]
    if operational_context:
        prompt_parts += [
            "Contexto operativo adicional del proyecto o empresa:",
            json.dumps(operational_context, ensure_ascii=False, indent=2),
        ]
    prompt_parts += [
        "Esquema JSON esperado:",
        json.dumps(response_schema, ensure_ascii=False, indent=2),
    ]

    user_prompt = "\n".join(prompt_parts)

    return PromptBundle(
        prompt_version=prompt_version,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
