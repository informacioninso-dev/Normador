import re
import unicodedata
from dataclasses import dataclass

from django.db.models import Max

from apps.common.choices import (
    DocumentProcessingStatus,
    DocumentType,
    EvidenceType,
    LibraryDocumentKind,
    LibraryUsage,
    RequirementCriticality,
)
from apps.documents.models import Document
from apps.standards.models import Standard, StandardRequirement


CLAUSE_PATTERN = re.compile(
    r"(?m)^\s*(?P<clause>(?:[4-9]|10)(?:\.\d+){0,4})\.?\s+(?P<context>[^\n]{4,180})"
)


@dataclass(frozen=True)
class LibrarySyncResult:
    created_requirements: int
    reference_documents: int
    extracted_clauses: int


AREA_RULES = [
    (
        "Control documental",
        ["document", "registro", "informacion documentada", "procedimiento", "formato"],
        DocumentType.PROCEDURE,
        EvidenceType.RECORD,
        ["Procedimiento de control documental", "Lista maestra de documentos", "Registro de cambios"],
        ["Documento vigente aprobado", "Registro diligenciado", "Trazabilidad de revision"],
    ),
    (
        "Recepcion",
        ["recepcion", "recibir", "proveedor", "insumo", "producto recibido"],
        DocumentType.PROCEDURE,
        EvidenceType.RECORD,
        ["Procedimiento de recepcion", "Formato de inspeccion de ingreso"],
        ["Registro de recepcion", "Liberacion o rechazo del lote recibido"],
    ),
    (
        "Almacenamiento",
        ["almacen", "almacenamiento", "preservacion", "temperatura", "humedad", "conservacion"],
        DocumentType.PROCEDURE,
        EvidenceType.RECORD,
        ["Procedimiento de almacenamiento", "Mapa o criterio de ubicacion"],
        ["Registro de condiciones de almacenamiento", "Evidencia de control ambiental"],
    ),
    (
        "Producto no conforme",
        ["no conforme", "conform", "rechazo", "segregacion", "devolucion"],
        DocumentType.PROCEDURE,
        EvidenceType.RECORD,
        ["Procedimiento de producto no conforme", "Formato de no conformidad"],
        ["Registro de tratamiento", "Evidencia de cierre de disposicion"],
    ),
    (
        "Auditoria interna",
        ["auditoria interna", "auditor", "programa de auditoria", "hallazgo"],
        DocumentType.PROCEDURE,
        EvidenceType.REPORT,
        ["Programa de auditoria", "Procedimiento de auditoria interna"],
        ["Informe de auditoria", "Plan de accion de hallazgos"],
    ),
    (
        "Revision por la direccion",
        ["revision por la direccion", "alta direccion", "entrada de revision", "salida de revision"],
        DocumentType.MINUTES,
        EvidenceType.MINUTES,
        ["Procedimiento o agenda de revision por la direccion"],
        ["Acta de revision por la direccion", "Compromisos y decisiones documentadas"],
    ),
]


CLAUSE_AREA_HINTS = {
    "7.5": "Control documental",
    "8.4": "Recepcion",
    "8.5.4": "Almacenamiento",
    "8.7": "Producto no conforme",
    "9.2": "Auditoria interna",
    "9.3": "Revision por la direccion",
}


def sync_standard_requirements_from_reference_library(
    standard: Standard,
) -> LibrarySyncResult:
    reference_documents = list(_matching_reference_documents(standard))
    existing_clauses = set(
        standard.requirements.values_list("clause", flat=True)
    )
    next_sequence = (
        standard.requirements.aggregate(max_sequence=Max("sequence"))["max_sequence"] or 0
    ) + 1

    seen_clauses = set()
    new_requirements = []

    for clause, context in _extract_clause_contexts(reference_documents):
        if clause in existing_clauses or clause in seen_clauses:
            continue
        seen_clauses.add(clause)
        payload = _build_requirement_payload(standard, clause, context, next_sequence)
        next_sequence += 1
        new_requirements.append(StandardRequirement(**payload))

    if new_requirements:
        StandardRequirement.objects.bulk_create(new_requirements)

    return LibrarySyncResult(
        created_requirements=len(new_requirements),
        reference_documents=len(reference_documents),
        extracted_clauses=len(seen_clauses),
    )


def _matching_reference_documents(standard: Standard):
    explicit_documents = Document.objects.filter(
        is_reference=True,
        status=DocumentProcessingStatus.READY,
        library_standard=standard,
    ).exclude(extracted_text="")
    explicit_documents = [
        document
        for document in explicit_documents.order_by("-uploaded_at", "-id")
        if _document_used_for_checklist(document)
    ]
    if explicit_documents:
        return explicit_documents

    ready_documents = Document.objects.filter(
        is_reference=True,
        status=DocumentProcessingStatus.READY,
        library_standard__isnull=True,
    ).exclude(extracted_text="")
    ready_documents = [
        document
        for document in ready_documents.order_by("-uploaded_at", "-id")
        if _document_used_for_checklist(document)
    ]

    matched = [
        document
        for document in ready_documents
        if _document_matches_standard(document, standard)
    ]
    return matched or ready_documents


def _document_used_for_checklist(document: Document) -> bool:
    usages = document.library_usages or []
    if usages and LibraryUsage.CHECKLIST not in usages and LibraryUsage.GENERAL not in usages:
        return False
    if document.library_kind == LibraryDocumentKind.COMPANY_CONTEXT:
        return False
    return True


def _document_matches_standard(document: Document, standard: Standard) -> bool:
    haystack = _normalize(
        " ".join(
            [
                document.title,
                document.file_name,
                document.extracted_text[:3000],
            ]
        )
    )
    candidates = {
        _normalize(standard.code.replace("_", " ")),
        _normalize(standard.name),
        _normalize(f"{standard.name} {standard.version}".strip()),
    }
    candidates = {candidate for candidate in candidates if len(candidate) >= 4}
    return any(candidate in haystack for candidate in candidates)


def _extract_clause_contexts(documents: list[Document]) -> list[tuple[str, str]]:
    clauses: list[tuple[str, str]] = []
    for document in documents:
        text = document.extracted_text.replace("\r\n", "\n")
        for match in CLAUSE_PATTERN.finditer(text):
            clause = match.group("clause").strip(". ")
            context = " ".join(match.group("context").split())
            if "." not in clause:
                continue
            if _looks_like_noise(context):
                continue
            clauses.append((clause, context))
    return clauses


def _looks_like_noise(context: str) -> bool:
    normalized = _normalize(context)
    if len(normalized) < 4:
        return True
    if re.search(r"\.{4,}", context):
        return True
    if "©" in context or "all rights reserved" in normalized:
        return True
    if normalized.startswith(("pagina", "page", "figura", "tabla")):
        return True
    return False


def _build_requirement_payload(
    standard: Standard,
    clause: str,
    context: str,
    sequence: int,
) -> dict:
    process_area = _infer_process_area(clause, context)
    rule = _area_rule(process_area)
    document_type = rule[2] if rule else DocumentType.OTHER
    evidence_type = rule[3] if rule else EvidenceType.OTHER
    expected_documents = rule[4] if rule else ["Criterio documentado aplicable"]
    expected_evidence = rule[5] if rule else ["Evidencia de ejecucion del control"]

    title = _title_for_clause(clause, process_area)
    return {
        "standard": standard,
        "clause": clause,
        "title": title,
        "requirement_text": (
            f"Implementar un criterio verificable para {process_area.lower()} "
            f"asociado a la clausula {clause}. Debe definir responsables, metodo, "
            "registros aplicables, evidencia de ejecucion y condiciones de cierre."
        ),
        "process_area": process_area,
        "criticality": _criticality_for(process_area),
        "expected_documents": expected_documents,
        "expected_evidence": expected_evidence,
        "verification_questions": [
            f"Existe un responsable definido para la clausula {clause}?",
            "La informacion documentada permite verificar ejecucion real?",
            "La evidencia cargada permite cerrar el requisito sin asumir cumplimiento?",
        ],
        "requires_real_evidence": True,
        "required_document_type": document_type,
        "required_evidence_type": evidence_type,
        "sequence": sequence,
    }


def _infer_process_area(clause: str, context: str) -> str:
    for prefix, area in CLAUSE_AREA_HINTS.items():
        if clause == prefix or clause.startswith(f"{prefix}."):
            return area

    normalized = _normalize(context)
    for area, keywords, *_ in AREA_RULES:
        if any(keyword in normalized for keyword in keywords):
            return area

    return "Implementacion normativa"


def _area_rule(process_area: str):
    return next((rule for rule in AREA_RULES if rule[0] == process_area), None)


def _title_for_clause(clause: str, process_area: str) -> str:
    if process_area == "Implementacion normativa":
        return f"Criterio de implementacion - clausula {clause}"
    return f"{process_area} - clausula {clause}"


def _criticality_for(process_area: str) -> str:
    if process_area in {"Producto no conforme", "Auditoria interna"}:
        return RequirementCriticality.HIGH
    if process_area in {"Control documental", "Recepcion", "Almacenamiento"}:
        return RequirementCriticality.MEDIUM
    return RequirementCriticality.MEDIUM


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    return normalized.encode("ascii", "ignore").decode("ascii")
