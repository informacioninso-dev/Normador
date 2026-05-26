import type {
  ActionPlan,
  ChecklistItem,
  DashboardData,
  DocumentRecord,
  EvidenceRecord,
  Finding,
  Project,
  ProjectWorkspace,
} from "./types";

export const DOCUMENTARY_DONE_STATUSES = new Set([
  "VALIDADO_DOCUMENTALMENTE",
  "IMPLEMENTADO",
  "CERRADO",
]);

export const IMPLEMENTATION_DONE_STATUSES = new Set(["IMPLEMENTADO", "CERRADO"]);

export const CLOSURE_DONE_STATUSES = new Set(["CERRADO"]);

export function averagePercentage(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeDocumentaryProgress(checklistItems: ChecklistItem[]): number {
  if (!checklistItems.length) {
    return 0;
  }
  const score = checklistItems.reduce((sum, item) => {
    return sum + (DOCUMENTARY_DONE_STATUSES.has(item.status) ? 100 : item.progress_percentage);
  }, 0);
  return Math.round(score / checklistItems.length);
}

export function computeImplementationProgress(checklistItems: ChecklistItem[]): number {
  if (!checklistItems.length) {
    return 0;
  }
  const score = checklistItems.reduce((sum, item) => {
    if (item.requires_real_evidence) {
      if (CLOSURE_DONE_STATUSES.has(item.status)) {
        return sum + 100;
      }
      if (IMPLEMENTATION_DONE_STATUSES.has(item.status)) {
        return sum + 90;
      }
      if (item.status === "VALIDADO_DOCUMENTALMENTE") {
        return sum + 55;
      }
      return sum + Math.min(item.progress_percentage, 50);
    }
    return sum + item.progress_percentage;
  }, 0);
  return Math.round(score / checklistItems.length);
}

export function projectChecklist(project: Project, checklistItems: ChecklistItem[]) {
  return checklistItems.filter((item) => item.project === project.id);
}

export function countOpenPendingItems(actionPlans: ActionPlan[], findings: Finding[]): number {
  const openPlans = actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  ).length;
  const openFindings = findings.filter((finding) => finding.status !== "CERRADO").length;
  return Math.max(openPlans, openFindings);
}

export function countObservedDocuments(documents: DocumentRecord[]): number {
  return documents.filter(
    (document) => document.status === "FALLIDO" || document.processing_error,
  ).length;
}

export function countValidatedEvidence(evidences: EvidenceRecord[]): number {
  return evidences.filter((evidence) => evidence.status === "VALIDADA").length;
}

export function summarizeProject(project: Project, workspace: ProjectWorkspace) {
  const checklistItems = workspace.checklistItems;
  const documents = workspace.documents;
  const findings = workspace.findings;
  const actionPlans = workspace.actionPlans;
  const evidences = workspace.evidences;

  return {
    documentaryProgress: computeDocumentaryProgress(checklistItems),
    implementationProgress: computeImplementationProgress(checklistItems),
    openPendingCount: countOpenPendingItems(actionPlans, findings),
    observedDocumentsCount: countObservedDocuments(documents),
    closedRequirementsCount: checklistItems.filter((item) => item.status === "CERRADO").length,
    validatedEvidenceCount: countValidatedEvidence(evidences),
    totalRequirements: checklistItems.length,
    project,
  };
}

export function summarizePortfolio(data: DashboardData) {
  const perProject = data.projects.map((project) => {
    const checklist = projectChecklist(project, data.checklistItems);
    const documents = data.documents.filter((document) => document.project === project.id);
    const findings = data.findings.filter((finding) => finding.project === project.id);
    const actionPlans = data.actionPlans.filter((plan) => plan.project === project.id);
    const evidences = data.evidences.filter((evidence) => evidence.project === project.id);

    return {
      project,
      documentaryProgress: computeDocumentaryProgress(checklist),
      implementationProgress: computeImplementationProgress(checklist),
      openPendingCount: countOpenPendingItems(actionPlans, findings),
      validatedEvidenceCount: countValidatedEvidence(evidences),
      observedDocumentsCount: countObservedDocuments(documents),
    };
  });

  return {
    projectSummaries: perProject,
    documentaryProgress: averagePercentage(
      perProject.map((item) => item.documentaryProgress),
    ),
    implementationProgress: averagePercentage(
      perProject.map((item) => item.implementationProgress),
    ),
    openPendingCount: countOpenPendingItems(data.actionPlans, data.findings),
    validatedEvidenceCount: countValidatedEvidence(data.evidences),
  };
}

export function groupChecklistByArea(checklistItems: ChecklistItem[]) {
  return checklistItems.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
    const area = item.process_area || "General";
    groups[area] ??= [];
    groups[area].push(item);
    return groups;
  }, {});
}

export function groupDocumentsByType(documents: DocumentRecord[]) {
  return documents.reduce<Record<string, DocumentRecord[]>>((groups, item) => {
    groups[item.document_type] ??= [];
    groups[item.document_type].push(item);
    return groups;
  }, {});
}
