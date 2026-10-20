import type { ChecklistItem, DocumentRecord, DocumentReview, EvidenceRecord } from "./types";

export const requirementSteps = [
  { value: "understand", label: "Qué se pide" },
  { value: "documents", label: "Documentación" },
  { value: "review", label: "Resultado de la revisión" },
  { value: "evidence", label: "Evidencia de implementación" },
] as const;
export type RequirementStep = typeof requirementSteps[number]["value"];

export const supportTypes = ["POLITICA", "PROCEDIMIENTO", "FORMATO", "REGISTRO", "MATRIZ", "INFORME", "ACTA", "EVIDENCIA", "OTRO"];
export const evidenceTypes = ["REGISTRO_DILIGENCIADO", "ACTA", "INFORME", "CAPACITACION", "CONTROL_EJECUTADO", "TRAZABILIDAD", "OTRO"];
export const activeJobStates = ["PENDING", "RUNNING", "RETRY"];

const labels: Record<string, string> = {
  POLITICA: "Política", PROCEDIMIENTO: "Procedimiento", FORMATO: "Formato", REGISTRO: "Registro", MATRIZ: "Matriz", INFORME: "Informe", ACTA: "Acta", EVIDENCIA: "Evidencia", OTRO: "Otro",
  REGISTRO_DILIGENCIADO: "Registro diligenciado", CAPACITACION: "Capacitación", CONTROL_EJECUTADO: "Control ejecutado", TRAZABILIDAD: "Trazabilidad",
  REVISION_DOCUMENTAL: "Revisión documental", CUMPLIMIENTO_NORMATIVO: "Cumplimiento de requisitos", CIERRE_NO_CONFORMIDAD: "Cierre de no conformidad", PREPARACION_AUDITORIA: "Preparación de auditoría", IMPLEMENTACION: "Implementación",
};
export function taskLabel(value: string) { return labels[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("es"); }

export function requirementSupport(item: ChecklistItem, documents: DocumentRecord[], reviews: DocumentReview[], evidences: EvidenceRecord[]) {
  return {
    documents: documents.filter((document) => document.project === item.project && (document.checklist_item === item.id || document.requirement === item.requirement)),
    reviews: reviews.filter((review) => review.project === item.project && review.requirement_evaluations.some((evaluation) => evaluation.requirement === item.requirement)).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id),
    evidences: evidences.filter((evidence) => evidence.project === item.project && (evidence.checklist_item === item.id || evidence.requirement === item.requirement)),
  };
}

/** Navigation advice only. The API alone decides compliance and closure. */
export function suggestRequirementStep(item: Pick<ChecklistItem, "status" | "requires_document" | "requires_evidence">, context: {
  canEdit: boolean; canValidate: boolean; hasDocuments: boolean; hasReview: boolean; pendingEvidence: boolean;
}): RequirementStep {
  if (item.status === "CERRADO") return "understand";
  if (!context.canEdit) {
    if (context.canValidate && context.pendingEvidence) return "evidence";
    return context.hasReview ? "review" : "understand";
  }
  if (["VALIDADO_DOCUMENTALMENTE", "IMPLEMENTADO"].includes(item.status)) return "evidence";
  if (!context.hasDocuments && item.requires_document) return "documents";
  if (context.hasDocuments && !context.hasReview) return "review";
  if (["OBSERVADO", "CUMPLE_PARCIAL", "EN_REVISION"].includes(item.status)) return "review";
  if (item.requires_evidence) return "evidence";
  return "understand";
}

export const requirementStatusHelp: Record<string, string> = {
  NO_INICIADO: "Empieza por comprobar qué documentos y evidencias pide este requisito.",
  PENDIENTE_DOCUMENTAL: "Falta aportar la documentación requerida.",
  EN_REVISION: "Consulta el estado del procesamiento y el resultado de la revisión documental.",
  CUMPLE_PARCIAL: "La revisión encontró soporte parcial. Consulta los faltantes antes de corregir el documento.",
  OBSERVADO: "Revisa las observaciones y los faltantes. La corrección debe conservar el soporte anterior.",
  VALIDADO_DOCUMENTALMENTE: "El soporte documental está validado. La implementación aún necesita las evidencias y condiciones de cierre aplicables.",
  IMPLEMENTADO: "La implementación está validada. Revisa las condiciones y acciones pendientes antes de considerar el cierre.",
  CERRADO: "El sistema registra este requisito como cerrado. Puedes consultar el soporte y su historial.",
};
