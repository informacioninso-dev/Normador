import Link from "next/link";
import { notFound } from "next/navigation";

import { regenerateChecklistFromLibraryAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { FlashBanner } from "@/components/flash-banner";
import { FormField } from "@/components/form-field";
import { RequirementWorkspace } from "@/components/requirement-workspace";
import { SectionCard } from "@/components/section-card";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCurrentUser, getProjectWorkspace } from "@/lib/api";
import { requirementSteps, requirementSupport, suggestRequirementStep } from "@/lib/workflow";

export default async function ProjectChecklistPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId: rawId }, query] = await Promise.all([params, searchParams]);
  const projectId = Number(rawId);
  if (!Number.isSafeInteger(projectId) || projectId < 1) notFound();
  const workspace = await getProjectWorkspace(projectId, ["checklistItems", "requirements", "documents", "evidences", "actionPlans", "reviews"]);
  if (!workspace.project) notFound();
  const project = workspace.project;
  const flash = decodeFlash(query);
  const pick = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const search = pick(query.q).trim(), status = pick(query.status), area = pick(query.area);
  const filtered = workspace.checklistItems.filter((item) => (!status || item.status === status) && (!area || item.process_area === area) && (!search || `${item.clause} ${item.title} ${item.implementation_task}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pick(query.page))) || 1));
  const basePath = `/projects/${projectId}/checklist`;
  const listParams = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: search, status, area, page: String(page) })) if (value) listParams.set(key, value);
  const href = (changes: Record<string, string | number>) => { const params = new URLSearchParams(listParams); for (const [key, value] of Object.entries(changes)) params.set(key, String(value)); return `${basePath}?${params}`; };
  const itemId = pick(query.item);
  const selected = itemId ? workspace.checklistItems.find((item) => String(item.id) === itemId) : undefined;
  if (itemId && !selected) notFound();
  if (selected) {
    const support = requirementSupport(selected, workspace.documents, workspace.reviews, workspace.evidences);
    const explicit = requirementSteps.find((step) => step.value === pick(query.step));
    const step = explicit?.value ?? suggestRequirementStep(selected, { canEdit: project.can_edit, canValidate: project.can_validate, hasDocuments: support.documents.length > 0, hasReview: support.reviews.length > 0, pendingEvidence: support.evidences.some((evidence) => evidence.status === "CARGADA") });
    return <div className="space-y-5"><FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} /><RequirementWorkspace workspace={workspace} item={selected} step={step} listQuery={listParams.toString()} /></div>;
  }
  const user = await getCurrentUser();
  return <div className="space-y-5">
    <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />
    <SectionCard title="Requisitos del proyecto" description="Elige un requisito. En su ficha podrás entender el criterio, aportar documentos, consultar la revisión y demostrar la implementación.">
      <form method="GET" action={basePath} className="grid items-end gap-3 md:grid-cols-4">
        <FormField label="Buscar cláusula o requisito"><input name="q" type="search" defaultValue={search} /></FormField>
        <FormField label="Estado del requisito"><select name="status" defaultValue={status}><option value="">Todos los estados</option>{[...new Set(workspace.checklistItems.map((item) => item.status))].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></FormField>
        <FormField label="Proceso"><select name="area" defaultValue={area}><option value="">Todos los procesos</option>{[...new Set(workspace.checklistItems.map((item) => item.process_area))].map((value) => <option key={value} value={value}>{value || "Sin proceso"}</option>)}</select></FormField>
        <div className="flex items-center gap-3"><button type="submit" className="min-h-11 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Buscar</button><Link href={basePath} className="inline-flex min-h-11 items-center text-sm text-signal underline">Limpiar</Link></div>
      </form>
      <p className="my-5 text-sm text-ink/70" role="status">{filtered.length} requisitos · Página {page} de {pages}</p>
      <ul className="divide-y divide-ink/10">{filtered.slice((page - 1) * 10, page * 10).map((item) => <li key={item.id}><Link href={href({ item: item.id, step: "understand" })} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div><strong className="break-words text-signal">{item.clause} · {item.title}</strong><p className="mt-2 text-sm text-ink/70">{item.process_area}</p><p className="mt-2 text-sm font-semibold">{project.can_edit ? "Abrir ficha y continuar" : "Abrir ficha del requisito"}</p></div><StatusBadge value={item.status} className="w-fit" /></Link></li>)}</ul>
      {!filtered.length && <p className="py-5 text-sm text-ink/70">{workspace.checklistItems.length ? "No hay coincidencias. Cambia la búsqueda o limpia los filtros." : "El proyecto todavía no tiene requisitos. Un administrador debe comprobar el catálogo de la norma seleccionada."}</p>}
      <nav aria-label="Páginas de requisitos" className="mt-4 flex justify-between gap-4">{page > 1 ? <Link href={href({ page: page - 1 })} className="inline-flex min-h-11 items-center text-signal underline">Anterior</Link> : <span />}{page < pages && <Link href={href({ page: page + 1 })} className="inline-flex min-h-11 items-center text-signal underline">Siguiente</Link>}</nav>
    </SectionCard>
    {user?.is_staff && <details className="rounded-xl border border-ink/15 p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Administrar el catálogo de requisitos</summary><p className="mb-4 mt-2 text-sm text-ink/70">Actualiza el catálogo desde las referencias normativas. Conserva el historial existente. Esta tarea corresponde a la administración de NORMAN.</p><ActionForm action={regenerateChecklistFromLibraryAction}><input type="hidden" name="return_path" value={basePath} /><input type="hidden" name="project_id" value={projectId} /><SubmitButton label="Actualizar requisitos desde las referencias" pendingLabel="Actualizando requisitos..." /></ActionForm></details>}
  </div>;
}
