import re
import time
import unicodedata
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction

from apps.ai_engine.models import AIProviderLog
from apps.ai_engine.ollama_client import OllamaAPIError, OllamaClient
from apps.ai_engine.prompt_builder import build_document_review_prompt
from apps.ai_engine.retriever import search_chunks
from apps.action_plans.services import (
    ensure_action_plans_for_findings,
    supersede_review_generated_gaps,
)
from apps.common.choices import (
    AILogStatus,
    AIOperationType,
    AIProvider,
    DocumentProcessingStatus,
    EmbeddingStatus,
    FindingStatus,
    FindingType,
    LibraryUsage,
    RequirementEvaluationStatus,
    RiskLevel,
)
from apps.documents.services import index_document_chunks
from apps.implementation.services import recalculate_checklist_item_state, resolve_project_checklist_item
from apps.reviews.models import DocumentReview, Finding, RequirementEvaluation


RISK_PRIORITY = {
    RiskLevel.LOW: 0,
    RiskLevel.MEDIUM: 1,
    RiskLevel.HIGH: 2,
}

REQUIREMENT_STATUS_VALUES = {
    RequirementEvaluationStatus.COMPLIES,
    RequirementEvaluationStatus.PARTIAL,
    RequirementEvaluationStatus.DOES_NOT_COMPLY,
    RequirementEvaluationStatus.NOT_APPLICABLE,
    RequirementEvaluationStatus.NOT_EVALUATED,
}
RISK_LEVEL_VALUES = {RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH}
FINDING_TYPE_VALUES = {
    FindingType.DOCUMENTARY_GAP,
    FindingType.IMPLEMENTATION_GAP,
    FindingType.AUDIT_RISK,
    FindingType.POTENTIAL_NONCONFORMITY,
    FindingType.OBSERVATION,
    FindingType.IMPROVEMENT_OPPORTUNITY,
}


class ReviewProviderError(RuntimeError):
    pass


@dataclass
class ReviewExecutionContext:
    document: object
    standard: object
    review_type: str
    requirements: list
    retrieved_context: dict
    prompt_bundle: object


class ReviewProvider:
    provider_name: str
    model_name: str

    def run_review(self, context: ReviewExecutionContext) -> tuple[dict, dict]:
        raise NotImplementedError


class MockReviewProvider(ReviewProvider):
    provider_name = AIProvider.MOCK
    model_name = "mock-review-v1"

    def run_review(self, context: ReviewExecutionContext) -> tuple[dict, dict]:
        evaluations = []
        findings = []

        for requirement in context.requirements:
            chunks = context.retrieved_context.get(str(requirement.id), {}).get("chunks", [])
            joined = " ".join(chunk.get("content", "") for chunk in chunks)
            status = self._infer_status(requirement, joined, context.document.document_type)
            risk_level = self._infer_risk(requirement.criticality, status)
            evidence_found = joined[:400]
            missing = []
            if requirement.requires_real_evidence:
                missing.extend(requirement.expected_evidence)
            if status != RequirementEvaluationStatus.COMPLIES:
                missing.extend(requirement.expected_documents)
            missing = list(dict.fromkeys(filter(None, missing)))

            gap = self._build_gap(status, requirement, chunks)
            recommendation = self._build_recommendation(status, requirement)
            suggested_text = self._build_suggested_text(status, requirement)
            can_close = (
                status == RequirementEvaluationStatus.COMPLIES
                and not requirement.requires_real_evidence
            )

            evaluations.append(
                {
                    "requirement_id": requirement.id,
                    "status": status,
                    "evidence_found": evidence_found,
                    "gap": gap,
                    "risk_level": risk_level,
                    "recommendation": recommendation,
                    "suggested_text": suggested_text,
                    "can_close_requirement": can_close,
                    "requires_real_evidence": requirement.requires_real_evidence,
                    "missing_documents_or_evidence": missing,
                }
            )

            if status != RequirementEvaluationStatus.COMPLIES:
                findings.append(
                    {
                        "requirement_id": requirement.id,
                        "type": FindingType.DOCUMENTARY_GAP,
                        "description": gap or f"Brecha documental en {requirement.title}.",
                        "risk_level": risk_level,
                        "recommended_action": recommendation,
                    }
                )
            elif requirement.requires_real_evidence:
                findings.append(
                    {
                        "requirement_id": requirement.id,
                        "type": FindingType.IMPLEMENTATION_GAP,
                        "description": (
                            f"El requisito {requirement.clause} cuenta con soporte documental, "
                            "pero aun requiere evidencia real de implementacion."
                        ),
                        "risk_level": risk_level,
                        "recommended_action": (
                            "Cargar evidencia operativa valida antes de cerrar el requisito."
                        ),
                    }
                )

        overall_status = _calculate_overall_status(evaluations)
        overall_risk = _calculate_overall_risk(evaluations)
        summary = _build_executive_summary(evaluations, findings)

        return (
            {
                "overall_status": overall_status,
                "risk_level": overall_risk,
                "executive_summary": summary,
                "requirement_evaluations": evaluations,
                "findings": findings,
                "implementation_pending_items": [],
            },
            {
                "provider": self.provider_name,
                "model": self.model_name,
            },
        )

    def _infer_status(self, requirement, joined_context: str, document_type: str) -> str:
        if not joined_context.strip():
            return RequirementEvaluationStatus.DOES_NOT_COMPLY

        normalized = joined_context.lower()
        tokens = _extract_keywords(
            " ".join(
                [
                    requirement.title,
                    requirement.requirement_text,
                    requirement.process_area,
                    " ".join(requirement.expected_documents),
                    " ".join(requirement.expected_evidence),
                ]
            )
        )
        if not tokens:
            return RequirementEvaluationStatus.PARTIAL

        matches = sum(1 for token in tokens if token in normalized)
        coverage = matches / len(tokens)
        type_match = document_type == requirement.required_document_type

        if coverage >= 0.45 and type_match:
            return RequirementEvaluationStatus.COMPLIES
        if coverage >= 0.18:
            return RequirementEvaluationStatus.PARTIAL
        return RequirementEvaluationStatus.DOES_NOT_COMPLY

    def _infer_risk(self, criticality: str, status: str) -> str:
        if status == RequirementEvaluationStatus.DOES_NOT_COMPLY:
            return RiskLevel.HIGH if criticality == "ALTA" else RiskLevel.MEDIUM
        if status == RequirementEvaluationStatus.PARTIAL:
            return RiskLevel.MEDIUM
        return RiskLevel.MEDIUM if criticality == "ALTA" else RiskLevel.LOW

    def _build_gap(self, status: str, requirement, chunks: list[dict]) -> str:
        if status == RequirementEvaluationStatus.COMPLIES:
            if requirement.requires_real_evidence:
                return "El soporte documental es suficiente, pero aun falta evidencia real validada."
            return ""
        if not chunks:
            return (
                f"No se encontro contenido suficiente del documento para demostrar el requisito "
                f"{requirement.clause}."
            )
        return (
            f"El documento contiene informacion relacionada con {requirement.title}, "
            "pero no demuestra todos los criterios esperados."
        )

    def _build_recommendation(self, status: str, requirement) -> str:
        if status == RequirementEvaluationStatus.COMPLIES:
            if requirement.requires_real_evidence:
                return "Adjuntar evidencia operativa valida para soportar la implementacion real."
            return "Mantener el documento vigente y controlado."
        return (
            f"Actualizar el documento para cubrir explicitamente el requisito {requirement.clause} "
            f"y vincular la evidencia esperada del proceso {requirement.process_area}."
        )

    def _build_suggested_text(self, status: str, requirement) -> str:
        if status == RequirementEvaluationStatus.COMPLIES:
            return ""
        return (
            f"Definir en el procedimiento de {requirement.process_area.lower()} "
            "los criterios, responsables, registros y evidencias asociados al requisito."
        )


class OllamaReviewProvider(ReviewProvider):
    provider_name = AIProvider.OLLAMA

    def __init__(self, client: OllamaClient | None = None, model_name: str | None = None):
        self.client = client or OllamaClient()
        self.model_name = model_name or settings.OLLAMA_CHAT_MODEL

    def run_review(self, context: ReviewExecutionContext) -> tuple[dict, dict]:
        response = self.client.chat_structured(
            model=self.model_name,
            system_prompt=context.prompt_bundle.system_prompt,
            user_prompt=context.prompt_bundle.user_prompt,
            schema=context.prompt_bundle.response_schema,
        )
        return response["parsed"], {
            "provider": self.provider_name,
            "model": self.model_name,
            "raw": response.get("raw", {}),
        }


def get_default_review_provider() -> ReviewProvider:
    if settings.AI_PROVIDER == AIProvider.MOCK:
        return MockReviewProvider()
    return OllamaReviewProvider()


def run_document_review(
    *,
    document,
    review_type: str,
    requirement_ids: list[int] | None = None,
    standard=None,
    created_by=None,
    provider: ReviewProvider | None = None,
    retrieval_provider=None,
) -> DocumentReview:
    if not document.project_id:
        raise ValueError("Document must belong to a project before review.")
    if document.status != DocumentProcessingStatus.READY:
        raise ValueError("Document must be in LISTO status before running a review.")

    standard = standard or document.project.standard
    if standard.id != document.project.standard_id:
        raise ValueError("Selected standard does not match the document project standard.")

    requirements = _resolve_requirements(document, standard, requirement_ids)
    if not requirements:
        raise ValueError("No requirements were resolved for this review.")

    if not document.chunks.filter(embedding_status=EmbeddingStatus.READY).exists():
        index_document_chunks(document, overwrite=True, created_by=created_by)

    retrieved_context = _build_retrieved_context(
        document,
        standard,
        requirements,
        retrieval_provider=retrieval_provider,
    )
    prompt_bundle = build_document_review_prompt(
        document=document,
        standard=standard,
        review_type=review_type,
        requirements=requirements,
        retrieved_context=retrieved_context,
    )

    provider = provider or get_default_review_provider()
    execution_context = ReviewExecutionContext(
        document=document,
        standard=standard,
        review_type=review_type,
        requirements=requirements,
        retrieved_context=retrieved_context,
        prompt_bundle=prompt_bundle,
    )

    request_payload = {
        "document_id": document.id,
        "project_id": document.project_id,
        "standard_id": standard.id,
        "review_type": review_type,
        "requirement_ids": [requirement.id for requirement in requirements],
        "provider": provider.provider_name,
        "model": provider.model_name,
    }
    started = time.perf_counter()

    try:
        response_payload, provider_meta = provider.run_review(execution_context)
        normalized = normalize_review_output(response_payload, requirements)
        latency_ms = int((time.perf_counter() - started) * 1000)
        review = _persist_review(
            document=document,
            standard=standard,
            review_type=review_type,
            prompt_bundle=prompt_bundle,
            retrieved_context=retrieved_context,
            normalized_output=normalized,
            raw_response=response_payload,
            ai_model_used=provider.model_name,
            created_by=created_by,
        )
        _update_checklist_from_review(review)
        AIProviderLog.objects.create(
            provider=provider.provider_name,
            model_name=provider.model_name,
            operation_type=AIOperationType.REVIEW,
            status=AILogStatus.SUCCESS,
            prompt_version=prompt_bundle.prompt_version,
            request_payload=request_payload,
            response_payload=provider_meta.get("raw", response_payload),
            latency_ms=latency_ms,
            created_by=created_by,
        )
        return review
    except OllamaAPIError:
        raise
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        AIProviderLog.objects.create(
            provider=provider.provider_name,
            model_name=provider.model_name,
            operation_type=AIOperationType.REVIEW,
            status=AILogStatus.ERROR,
            prompt_version=prompt_bundle.prompt_version,
            request_payload=request_payload,
            response_payload={},
            error_message=str(exc),
            latency_ms=latency_ms,
            created_by=created_by,
        )
        raise


def normalize_review_output(payload: dict, requirements: list) -> dict:
    if not isinstance(payload, dict):
        raise ReviewProviderError("Review provider returned a non-object payload.")

    overall_status = _normalize_status(payload.get("overall_status"))
    risk_level = _normalize_risk(payload.get("risk_level"))
    summary = str(payload.get("executive_summary") or "").strip()

    requirement_lookup = {requirement.id: requirement for requirement in requirements}
    raw_evaluations = payload.get("requirement_evaluations") or []
    normalized_evaluations = {}

    for item in raw_evaluations:
        if not isinstance(item, dict):
            continue
        requirement_id = _coerce_requirement_id(item.get("requirement_id"), requirement_lookup)
        if requirement_id is None:
            continue

        requirement = requirement_lookup[requirement_id]
        normalized_evaluations[requirement_id] = {
            "requirement_id": requirement_id,
            "status": _normalize_status(item.get("status")),
            "evidence_found": str(item.get("evidence_found") or "").strip(),
            "gap": str(item.get("gap") or "").strip(),
            "risk_level": _normalize_risk(item.get("risk_level")),
            "recommendation": str(item.get("recommendation") or "").strip(),
            "suggested_text": str(item.get("suggested_text") or "").strip(),
            "can_close_requirement": bool(item.get("can_close_requirement")),
            "requires_real_evidence": bool(
                item.get("requires_real_evidence", requirement.requires_real_evidence)
            ),
            "missing_documents_or_evidence": [
                str(value).strip()
                for value in (item.get("missing_documents_or_evidence") or [])
                if str(value).strip()
            ],
        }

    for requirement in requirements:
        if requirement.id in normalized_evaluations:
            continue
        normalized_evaluations[requirement.id] = {
            "requirement_id": requirement.id,
            "status": RequirementEvaluationStatus.NOT_EVALUATED,
            "evidence_found": "",
            "gap": "La IA no devolvio una evaluacion para este requisito.",
            "risk_level": RiskLevel.MEDIUM,
            "recommendation": "Revisar manualmente el requisito y repetir el analisis.",
            "suggested_text": "",
            "can_close_requirement": False,
            "requires_real_evidence": requirement.requires_real_evidence,
            "missing_documents_or_evidence": [],
        }

    normalized_findings = []
    for item in payload.get("findings") or []:
        if not isinstance(item, dict):
            continue
        requirement_id = _coerce_requirement_id(item.get("requirement_id"), requirement_lookup)
        finding_type = item.get("type")
        risk = item.get("risk_level")
        if finding_type not in FINDING_TYPE_VALUES:
            finding_type = FindingType.OBSERVATION
        if risk not in RISK_LEVEL_VALUES:
            risk = RiskLevel.MEDIUM
        normalized_findings.append(
            {
                "requirement_id": requirement_id,
                "type": finding_type,
                "description": str(item.get("description") or "").strip(),
                "risk_level": risk,
                "recommended_action": str(item.get("recommended_action") or "").strip(),
            }
        )

    if overall_status == RequirementEvaluationStatus.NOT_EVALUATED:
        overall_status = _calculate_overall_status(normalized_evaluations.values())
    if risk_level == RiskLevel.MEDIUM and payload.get("risk_level") not in RISK_LEVEL_VALUES:
        risk_level = _calculate_overall_risk(normalized_evaluations.values())
    if not summary:
        summary = _build_executive_summary(
            list(normalized_evaluations.values()),
            normalized_findings,
        )

    return {
        "overall_status": overall_status,
        "risk_level": risk_level,
        "executive_summary": summary,
        "requirement_evaluations": list(normalized_evaluations.values()),
        "findings": normalized_findings,
        "implementation_pending_items": payload.get("implementation_pending_items") or [],
    }


def _resolve_requirements(document, standard, requirement_ids):
    queryset = standard.requirements.all().order_by("sequence", "clause", "id")
    if requirement_ids:
        return list(queryset.filter(id__in=requirement_ids))
    if document.requirement_id:
        requirement = queryset.filter(id=document.requirement_id).first()
        if requirement:
            return [requirement]
    return list(queryset)


def _build_retrieved_context(document, standard, requirements, retrieval_provider=None):
    context = {}
    library_limit = max(2, (settings.REVIEW_CONTEXT_TOP_K or 5) // 2)

    for requirement in requirements:
        query = " ".join(
            [
                requirement.clause,
                requirement.title,
                requirement.requirement_text,
                " ".join(requirement.expected_documents),
                " ".join(requirement.expected_evidence),
            ]
        )
        doc_results = search_chunks(
            query,
            provider=retrieval_provider,
            document_id=document.id,
            limit=settings.REVIEW_CONTEXT_TOP_K,
        )
        lib_results = search_chunks(
            query,
            provider=retrieval_provider,
            project_id=document.project_id,
            standard_id=standard.id,
            library_only=True,
            library_usage=LibraryUsage.REVIEW_CONTEXT,
            process_area=requirement.process_area,
            limit=library_limit,
        )
        project_results = [
            result
            for result in search_chunks(
                query,
                provider=retrieval_provider,
                project_id=document.project_id,
                standard_id=standard.id,
                limit=library_limit + 3,
            )
            if result.chunk.document_id != document.id
        ][:library_limit]
        context[str(requirement.id)] = {
            "requirement_id": requirement.id,
            "chunks": [
                {
                    "chunk_id": result.chunk.id,
                    "chunk_index": result.chunk.chunk_index,
                    "score": round(result.score, 6),
                    "content": result.chunk.content,
                }
                for result in doc_results
            ],
            "reference_chunks": [
                {
                    "chunk_id": result.chunk.id,
                    "document_title": result.chunk.document.title,
                    "score": round(result.score, 6),
                    "content": result.chunk.content,
                }
                for result in lib_results
            ],
            "project_context_chunks": [
                {
                    "chunk_id": result.chunk.id,
                    "document_title": result.chunk.document.title,
                    "document_type": result.chunk.document.document_type,
                    "score": round(result.score, 6),
                    "content": result.chunk.content,
                }
                for result in project_results
            ],
        }
    return context


@transaction.atomic
def _persist_review(
    *,
    document,
    standard,
    review_type: str,
    prompt_bundle,
    retrieved_context: dict,
    normalized_output: dict,
    raw_response: dict,
    ai_model_used: str,
    created_by,
) -> DocumentReview:
    review = DocumentReview.objects.create(
        document=document,
        project=document.project,
        standard=standard,
        review_type=review_type,
        overall_status=normalized_output["overall_status"],
        risk_level=normalized_output["risk_level"],
        summary=normalized_output["executive_summary"],
        prompt_version=prompt_bundle.prompt_version,
        system_prompt_used=prompt_bundle.system_prompt,
        user_prompt_used=prompt_bundle.user_prompt,
        raw_response=raw_response,
        retrieved_context=retrieved_context,
        ai_model_used=ai_model_used,
        created_by=created_by,
    )

    evaluations = [
        RequirementEvaluation(
            document_review=review,
            requirement_id=item["requirement_id"],
            status=item["status"],
            evidence_found=item["evidence_found"],
            gap=item["gap"],
            risk_level=item["risk_level"],
            recommendation=item["recommendation"],
            suggested_text=item["suggested_text"],
            can_close_requirement=item["can_close_requirement"],
            requires_real_evidence=item["requires_real_evidence"],
            missing_documents_or_evidence=item["missing_documents_or_evidence"],
        )
        for item in normalized_output["requirement_evaluations"]
    ]
    if evaluations:
        RequirementEvaluation.objects.bulk_create(evaluations)

    supersede_review_generated_gaps(
        project=document.project,
        requirement_ids=[
            item["requirement_id"] for item in normalized_output["requirement_evaluations"]
        ],
        exclude_review_id=review.id,
    )

    findings = []
    for item in normalized_output["findings"]:
        if not item["description"]:
            continue
        findings.append(
            Finding.objects.create(
                project=document.project,
                document_review=review,
                requirement_id=item["requirement_id"],
                finding_type=item["type"],
                description=item["description"],
                risk_level=item["risk_level"],
                recommended_action=item["recommended_action"],
                status=FindingStatus.OPEN,
            )
        )

    if findings:
        ensure_action_plans_for_findings(findings, created_by=created_by)

    return review


def _update_checklist_from_review(review: DocumentReview) -> None:
    evaluations = review.requirement_evaluations.select_related("requirement")
    for evaluation in evaluations:
        checklist_item = resolve_project_checklist_item(review.project, evaluation.requirement_id)
        if checklist_item is None:
            continue
        recalculate_checklist_item_state(checklist_item)


def _normalize_status(value) -> str:
    if value in REQUIREMENT_STATUS_VALUES:
        return value
    return RequirementEvaluationStatus.NOT_EVALUATED


def _normalize_risk(value) -> str:
    if value in RISK_LEVEL_VALUES:
        return value
    return RiskLevel.MEDIUM


def _coerce_requirement_id(value, lookup: dict) -> int | None:
    try:
        requirement_id = int(value)
    except (TypeError, ValueError):
        return None
    return requirement_id if requirement_id in lookup else None


def _calculate_overall_status(evaluations) -> str:
    normalized = list(evaluations)
    if any(item["status"] == RequirementEvaluationStatus.DOES_NOT_COMPLY for item in normalized):
        return RequirementEvaluationStatus.DOES_NOT_COMPLY
    if any(item["status"] == RequirementEvaluationStatus.PARTIAL for item in normalized):
        return RequirementEvaluationStatus.PARTIAL
    if normalized and all(item["status"] == RequirementEvaluationStatus.NOT_APPLICABLE for item in normalized):
        return RequirementEvaluationStatus.NOT_APPLICABLE
    if normalized and all(
        item["status"] in {RequirementEvaluationStatus.COMPLIES, RequirementEvaluationStatus.NOT_APPLICABLE}
        for item in normalized
    ):
        return RequirementEvaluationStatus.COMPLIES
    return RequirementEvaluationStatus.NOT_EVALUATED


def _calculate_overall_risk(evaluations) -> str:
    highest = RiskLevel.LOW
    for item in evaluations:
        risk = item["risk_level"]
        if RISK_PRIORITY[risk] > RISK_PRIORITY[highest]:
            highest = risk
    return highest


def _build_executive_summary(evaluations, findings) -> str:
    counts = {
        RequirementEvaluationStatus.COMPLIES: 0,
        RequirementEvaluationStatus.PARTIAL: 0,
        RequirementEvaluationStatus.DOES_NOT_COMPLY: 0,
        RequirementEvaluationStatus.NOT_APPLICABLE: 0,
        RequirementEvaluationStatus.NOT_EVALUATED: 0,
    }
    for item in evaluations:
        counts[item["status"]] += 1

    return (
        f"Evaluados {len(evaluations)} requisitos: "
        f"{counts[RequirementEvaluationStatus.COMPLIES]} cumplen, "
        f"{counts[RequirementEvaluationStatus.PARTIAL]} cumplen parcialmente, "
        f"{counts[RequirementEvaluationStatus.DOES_NOT_COMPLY]} no cumplen. "
        f"Hallazgos generados: {len(findings)}."
    )


def _extract_keywords(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", (text or "").lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    tokens = re.findall(r"[a-z0-9]{5,}", ascii_text)
    return list(dict.fromkeys(tokens))
