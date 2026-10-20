import type { Company } from "./types";

export const companyRoles = [
  { value: "RESPONSABLE", label: "Responsable", description: "Gestiona el equipo, prepara el trabajo y valida evidencias y cierres." },
  { value: "IMPLEMENTADOR", label: "Implementador", description: "Prepara proyectos, documentos, revisiones y acciones; no valida el cierre final." },
  { value: "AUDITOR", label: "Auditor", description: "Consulta y valida soportes y cierres; no prepara documentos." },
  { value: "LECTOR", label: "Lector", description: "Consulta y descarga información; no modifica ni valida." },
] as const;

export function companyRoleLabel(role: string) {
  return role === "ADMINISTRADOR" ? "Administrador global" : companyRoles.find((item) => item.value === role)?.label ?? role;
}

export function canManageCompany(company: Company) {
  return ["ADMINISTRADOR", "RESPONSABLE"].includes(company.my_role);
}

export function canPrepareCompany(company: Company) {
  return ["ADMINISTRADOR", "RESPONSABLE", "IMPLEMENTADOR"].includes(company.my_role);
}
