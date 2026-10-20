import { NextRequest, NextResponse } from "next/server";
import { getProjectWorkspace } from "@/lib/api";
import { requirementSupport, suggestRequirementStep, requirementStatusHelp } from "@/lib/workflow";

export async function GET(request: NextRequest) {
  const projectId = Number(request.nextUrl.searchParams.get("project"));
  const itemId = Number(request.nextUrl.searchParams.get("item"));
  if (!Number.isSafeInteger(projectId) || projectId < 1) return NextResponse.json({ detail: "Proyecto inválido." }, { status: 400 });
  const workspace = await getProjectWorkspace(projectId, ["checklistItems", "documents", "reviews", "evidences"]);
  const project = workspace.project;
  if (!project) return NextResponse.json({ detail: "Proyecto no disponible." }, { status: 404 });
  if (workspace.errors.length) return NextResponse.json({ detail: "No pude consultar el estado actual. Vuelve a intentarlo." }, { status: 503 });
  const item = itemId ? workspace.checklistItems.find((i) => i.id === itemId) : workspace.checklistItems.find((i) => i.status !== "CERRADO");
  if (itemId && !item) return NextResponse.json({ detail: "Requisito no disponible." }, { status: 404 });
  if (!item) return NextResponse.json({ text: workspace.checklistItems.length ? "Todos los requisitos figuran cerrados. Puedes consultar la matriz y su soporte." : "El proyecto aún no tiene requisitos. Revisa el catálogo de la norma.", href: `/projects/${projectId}/checklist`, label: "Ver requisitos", mood: "ready" }, { headers: { "Cache-Control": "private, no-store" } });
  const support = requirementSupport(item, workspace.documents, workspace.reviews, workspace.evidences);
  const step = suggestRequirementStep(item, { canEdit: project.can_edit, canValidate: project.can_validate,
    hasDocuments: support.documents.some((d) => d.status !== "ARCHIVADO"), hasReview: support.reviews.length > 0,
    pendingEvidence: support.evidences.some((e) => e.status === "CARGADA") });
  return NextResponse.json({ text: requirementStatusHelp[item.status] || "Consulta el soporte de este requisito.",
    title: `${item.clause} · ${item.title}`, href: `/projects/${projectId}/checklist?item=${item.id}&step=${step}`,
    label: "Abrir siguiente paso", mood: ["OBSERVADO", "CUMPLE_PARCIAL"].includes(item.status) ? "attention" : "ready" },
    { headers: { "Cache-Control": "private, no-store" } });
}
