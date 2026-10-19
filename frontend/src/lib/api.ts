import type {
  ActionPlan,
  AppUser,
  ChecklistItem,
  Company,
  CompanyMembership,
  DashboardData,
  DocumentRecord,
  DocumentReview,
  EvidenceRecord,
  Finding,
  ImplementationActivity,
  Project,
  ProjectWorkspace,
  QueryValue,
  Standard,
  StandardRequirement,
  WorkLogEvidenceRecord,
  WorkLogEntry,
} from "./types";
import { getAuthHeaders } from "./auth";
import { cache } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

type QueryParams = Record<string, QueryValue>;
type SafeResponse<T> = { data: T; error?: string };

function buildApiUrl(path: string, query?: QueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, API_BASE_URL);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export class ApiError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string> = {}) { super(message); }
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.detail === "string") {
      return new ApiError(payload.detail);
    }
    const fieldErrors = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "non_field_errors").map(([key, value]) => [key, (Array.isArray(value) ? value.join(" ") : String(value)).replaceAll("This field is required.", "Este campo es obligatorio.").replaceAll("This field may not be blank.", "Este campo no puede estar vacío.")]));
    return new ApiError(Array.isArray(payload.non_field_errors) ? payload.non_field_errors.join(" ") : "Revisa los campos indicados para continuar.", fieldErrors);
  }

  const text = await response.text();
  return new ApiError(response.status >= 500 ? "El servidor no pudo completar la solicitud. Reintenta sin cambiar los datos." : text || `HTTP ${response.status}`);
}

export async function apiGet<T>(path: string, query?: QueryParams): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(path, query), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...authHeaders,
    },
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  return (await response.json()) as T;
}

export async function safeApiGet<T>(
  path: string,
  fallback: T,
  query?: QueryParams,
): Promise<SafeResponse<T>> {
  try {
    const data = await apiGet<T>(path, query);
    return { data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo conectar con el backend.";
    return { data: fallback, error: message };
  }
}

export async function apiJsonMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  payload: Record<string, unknown>,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiFormMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  payload: FormData,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      ...authHeaders,
    },
    body: payload,
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function decodeFlash(searchParams?: Record<string, string | string[] | undefined>) {
  const pick = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;

  const error = pick(searchParams?.error);
  const success = pick(searchParams?.success);

  return {
    error: error ?? "",
    success: success ?? "",
  };
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [
    companies,
    projects,
    standards,
    checklistItems,
    documents,
    reviews,
    findings,
    actionPlans,
    evidences,
    worklogs,
  ] = await Promise.all([
    safeApiGet<Company[]>("/api/companies/", []),
    safeApiGet<Project[]>("/api/projects/", []),
    safeApiGet<Standard[]>("/api/standards/", []),
    safeApiGet<ChecklistItem[]>("/api/checklist-items/", []),
    safeApiGet<DocumentRecord[]>("/api/documents/", []),
    safeApiGet<DocumentReview[]>("/api/document-reviews/", []),
    safeApiGet<Finding[]>("/api/findings/", []),
    safeApiGet<ActionPlan[]>("/api/action-plans/", []),
    safeApiGet<EvidenceRecord[]>("/api/evidences/", []),
    safeApiGet<WorkLogEntry[]>("/api/worklogs/", []),
  ]);

  return {
    companies: companies.data,
    projects: projects.data,
    standards: standards.data,
    checklistItems: checklistItems.data,
    documents: documents.data,
    reviews: reviews.data,
    findings: findings.data,
    actionPlans: actionPlans.data,
    evidences: evidences.data,
    worklogs: worklogs.data,
    errors: [
      companies.error,
      projects.error,
      standards.error,
      checklistItems.error,
      documents.error,
      reviews.error,
      findings.error,
      actionPlans.error,
      evidences.error,
      worklogs.error,
    ].filter(Boolean) as string[],
  };
}

export async function getCompaniesData() {
  const [companies, projects, memberships] = await Promise.all([
    safeApiGet<Company[]>("/api/companies/", []),
    safeApiGet<Project[]>("/api/projects/", []),
    safeApiGet<CompanyMembership[]>("/api/company-memberships/", []),
  ]);

  return {
    companies: companies.data,
    projects: projects.data,
    memberships: memberships.data,
    errors: [companies.error, projects.error, memberships.error].filter(Boolean) as string[],
  };
}

export async function getProjectsData() {
  const [companies, standards, projects, checklistItems, actionPlans] = await Promise.all([
    safeApiGet<Company[]>("/api/companies/", []),
    safeApiGet<Standard[]>("/api/standards/", []),
    safeApiGet<Project[]>("/api/projects/", []),
    safeApiGet<ChecklistItem[]>("/api/checklist-items/", []),
    safeApiGet<ActionPlan[]>("/api/action-plans/", []),
  ]);

  return {
    companies: companies.data,
    standards: standards.data,
    projects: projects.data,
    checklistItems: checklistItems.data,
    actionPlans: actionPlans.data,
    errors: [
      companies.error,
      standards.error,
      projects.error,
      checklistItems.error,
      actionPlans.error,
    ].filter(Boolean) as string[],
  };
}

export async function apiDelete(path: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(path), {
    method: "DELETE",
    headers: { ...authHeaders },
  });
  if (!response.ok && response.status !== 204) {
    throw await readApiError(response);
  }
}

export async function getUsersData(): Promise<{ users: AppUser[]; errors: string[] }> {
  const result = await safeApiGet<AppUser[]>("/api/users/", []);
  return { users: result.data, errors: [result.error].filter(Boolean) as string[] };
}

export async function getCurrentUser(): Promise<{ username: string; is_staff: boolean } | null> {
  try {
    const data = await apiGet<{ username: string; is_staff: boolean }>("/api/auth/me/");
    return data;
  } catch {
    return null;
  }
}

export async function getLibraryData() {
  const [documents, standards, companies, projects] = await Promise.all([
    safeApiGet<DocumentRecord[]>("/api/documents/", [], {
      is_reference: "true",
    }),
    safeApiGet<Standard[]>("/api/standards/", []),
    safeApiGet<Company[]>("/api/companies/", []),
    safeApiGet<Project[]>("/api/projects/", []),
  ]);
  return {
    documents: documents.data,
    standards: standards.data,
    companies: companies.data,
    projects: projects.data,
    errors: [
      documents.error,
      standards.error,
      companies.error,
      projects.error,
    ].filter(Boolean) as string[],
  };
}

const getProjectRecord = cache((projectId: number) => safeApiGet<Project | null>(`/api/projects/${projectId}/`, null));

export async function getProjectHeader(projectId: number) {
  const [project, report] = await Promise.all([
    getProjectRecord(projectId),
    safeApiGet<{ summary: { documentary_progress_percentage: number; implementation_progress_percentage: number; has_simulated_reviews: boolean } } | null>(`/api/projects/${projectId}/progress_report/`, null),
  ]);
  return { project: project.data, summary: report.data?.summary, error: project.error || report.error };
}

type WorkspaceSection = Exclude<keyof ProjectWorkspace, "project" | "errors">;
export async function getProjectWorkspace(projectId: number, sections?: WorkspaceSection[], documentText = false): Promise<ProjectWorkspace> {
  const projectResponse = await getProjectRecord(projectId);
  const needs = (name: WorkspaceSection) => !sections || sections.includes(name);
  const project = projectResponse.data;

  if (!project) {
    return {
      project: null,
      standard: null,
      requirements: [],
      checklistItems: [],
      documents: [],
      reviews: [],
      findings: [],
      actionPlans: [],
      implementationActivities: [],
      evidences: [],
      worklogs: [],
      worklogEvidences: [],
      errors: [
        projectResponse.error ?? "No se encontro el proyecto solicitado.",
      ],
    };
  }

  const [
    standard,
    requirements,
    checklistItems,
    documents,
    reviews,
    findings,
    actionPlans,
    implementationActivities,
    evidences,
    worklogs,
    worklogEvidences,
  ] = await Promise.all([
    needs("standard") ? safeApiGet<Standard | null>(`/api/standards/${project.standard}/`, null) : { data: null, error: undefined },
    needs("requirements") ? safeApiGet<StandardRequirement[]>("/api/requirements/", [], {
      standard: project.standard,
    }) : { data: [], error: undefined },
    needs("checklistItems") ? safeApiGet<ChecklistItem[]>("/api/checklist-items/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("documents") ? safeApiGet<DocumentRecord[]>("/api/documents/", [], {
      project: projectId,
      summary: documentText ? undefined : "true",
    }) : { data: [], error: undefined },
    needs("reviews") ? safeApiGet<DocumentReview[]>("/api/document-reviews/", [], {
      project: projectId,
      summary: "true",
    }) : { data: [], error: undefined },
    needs("findings") ? safeApiGet<Finding[]>("/api/findings/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("actionPlans") ? safeApiGet<ActionPlan[]>("/api/action-plans/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("implementationActivities") ? safeApiGet<ImplementationActivity[]>("/api/implementation-activities/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("evidences") ? safeApiGet<EvidenceRecord[]>("/api/evidences/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("worklogs") ? safeApiGet<WorkLogEntry[]>("/api/worklogs/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
    needs("worklogEvidences") ? safeApiGet<WorkLogEvidenceRecord[]>("/api/worklog-evidences/", [], {
      project: projectId,
    }) : { data: [], error: undefined },
  ]);

  return {
    project,
    standard: standard.data,
    requirements: requirements.data,
    checklistItems: checklistItems.data,
    documents: documents.data,
    reviews: reviews.data,
    findings: findings.data,
    actionPlans: actionPlans.data,
    implementationActivities: implementationActivities.data,
    evidences: evidences.data,
    worklogs: worklogs.data,
    worklogEvidences: worklogEvidences.data,
    errors: [
      projectResponse.error,
      standard.error,
      requirements.error,
      checklistItems.error,
      documents.error,
      reviews.error,
      findings.error,
      actionPlans.error,
      implementationActivities.error,
      evidences.error,
      worklogs.error,
      worklogEvidences.error,
    ].filter(Boolean) as string[],
  };
}
