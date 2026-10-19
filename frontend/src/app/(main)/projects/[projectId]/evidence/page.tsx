import { FormField } from "@/components/form-field";
﻿import Link from "next/link";
import { notFound } from "next/navigation";
import { createEvidenceAction, validateEvidenceAction } from "@/app/actions";
import { RoleForm } from "@/components/role-form";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/presentation";
const evidenceTypes = ["REGISTRO_DILIGENCIADO", "ACTA", "INFORME", "CAPACITACION", "CONTROL_EJECUTADO", "TRAZABILIDAD", "OTRO"];
export default async function ProjectEvidencePage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId: rawId } = await params;
  const query = await searchParams;
  const projectId = Number(rawId);
  if (!Number.isSafeInteger(projectId) || projectId < 1) notFound();
  const workspace = await getProjectWorkspace(projectId, ["evidences","requirements"]);
  if (!workspace.project) notFound();
  const flash = decodeFlash(query);
  const returnPath = `/projects/${projectId}/evidence`;
  const status = typeof query.status === "string" ? query.status : "";
  const requirement = typeof query.requirement === "string" ? query.requirement : "";
  const filtered = workspace.evidences.filter((item) => (!status || item.status === status) && (!requirement || item.requirement === Number(requirement)));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.page)) || 1));
  const url = (nextPage: number) => `${returnPath}?${new URLSearchParams({ status, requirement, page: String(nextPage) })}`;
  return <div className="space-y-6">
    <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />
    <SectionCard title="Registrar evidencia" description="Adjunta el soporte real. Un auditor o responsable revisará su contenido antes de validarlo. Las correcciones se conservan como nuevas evidencias.">
      <RoleForm allowed={workspace.project.can_edit} action={createEvidenceAction} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="project" value={projectId} />
        <div><FormField label={<>Requisito</>}><select name="requirement" defaultValue={requirement}><option value="">Sin requisito específico</option>{workspace.requirements.map((item) => <option key={item.id} value={item.id}>{item.clause} · {item.title}</option>)}</select></FormField></div>
        <div><FormField label={<>Título</>}><input name="title" required /></FormField></div>
        <div><FormField label={<>Tipo de evidencia</>}><select name="evidence_type" defaultValue="OTRO">{evidenceTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></FormField></div>
        <div><FormField label={<>Fecha de ocurrencia</>}><input type="date" name="occurred_on" /></FormField></div>
        <div><FormField label={<>Archivo de soporte</>}><input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png" /></FormField></div>
        <div><FormField label={<>Descripción y contexto</>}><textarea name="description" /></FormField></div>
        <SubmitButton label="Registrar evidencia" pendingLabel="Guardando..." />
      </RoleForm>
    </SectionCard>
    <SectionCard title="Evidencias e historial" description="Abre el soporte y revisa su relación con el requisito. Una evidencia rechazada sigue disponible en el historial.">
      <form method="get" className="mb-5 grid gap-3 md:grid-cols-3">
        <div><label htmlFor="evidence-status">Estado</label><select id="evidence-status" name="status" defaultValue={status}><option value="">Todos</option><option value="CARGADA">Pendientes de revisión</option><option value="VALIDADA">Validadas</option><option value="RECHAZADA">Rechazadas</option></select></div>
        <div><label htmlFor="evidence-requirement">Requisito</label><select id="evidence-requirement" name="requirement" defaultValue={requirement}><option value="">Todos</option>{workspace.requirements.map((item) => <option key={item.id} value={item.id}>{item.clause} · {item.title}</option>)}</select></div>
        <div className="flex items-end"><SubmitButton label="Filtrar" /></div>
      </form>
      <p role="status" className="mb-4">{filtered.length} evidencias · Página {page} de {pages}</p>
      <div className="space-y-5">{filtered.slice((page - 1) * 10, page * 10).map((item) => <article key={item.id} id={`evidence-${item.id}`} className="rounded-xl border border-black/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{item.title}</h3><StatusBadge value={item.status} /></div>
        <p className="mt-2">{item.clause || "Sin cláusula"} · {item.requirement_title || "Sin requisito asociado"}</p>
        <p className="mt-2 whitespace-pre-wrap break-words">{item.description || "Sin descripción adicional."}</p>
        <p className="mt-2 text-sm text-moss">Ocurrencia: {formatDate(item.occurred_on)} · Carga: {formatDateTime(item.uploaded_at)}</p>
        {item.file ? <a className="my-3 inline-flex min-h-11 items-center font-semibold underline" href={item.file} target="_blank" rel="noopener noreferrer">Abrir o descargar {item.file_name || "soporte"} (nueva pestaña)</a> : <p className="my-3 font-semibold">No hay archivo adjunto. Revisa la descripción y el contexto antes de decidir.</p>}
        {item.validation_notes && <p className="mt-2 whitespace-pre-wrap"><strong>Notas de la decisión:</strong> {item.validation_notes}</p>}
        {item.validated_at && <p className="mt-2 text-sm">Decisión: {formatDateTime(item.validated_at)} · Usuario #{item.validated_by ?? "no registrado"}</p>}
        {item.status === "RECHAZADA" && <p className="mt-3">Carga una nueva evidencia corregida usando el formulario de arriba. El rechazo y el soporte original se conservan.</p>}
        {item.status === "CARGADA" && workspace.project?.can_validate && <div className="mt-4 grid gap-5 md:grid-cols-2">
          <RoleForm allowed action={validateEvidenceAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="evidence_id" value={item.id} /><input type="hidden" name="transition" value="validate_evidence" />
            <label className="flex items-start gap-2"><input className="mt-1 h-5 w-5" type="checkbox" name="confirmed" required />He revisado el soporte y su relación con el requisito.</label>
            <div><FormField label={<>Notas de validación</>}><textarea name="validation_notes" /></FormField></div><SubmitButton label="Validar evidencia" pendingLabel="Validando..." />
          </RoleForm>
          <RoleForm allowed action={validateEvidenceAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="evidence_id" value={item.id} /><input type="hidden" name="transition" value="reject_evidence" />
            <div><FormField label={<>Motivo del rechazo</>}><textarea name="validation_notes" required /></FormField></div><SubmitButton label="Rechazar evidencia" pendingLabel="Guardando..." />
          </RoleForm>
        </div>}
      </article>)}</div>
      {!filtered.length && <p>No hay evidencias que coincidan con los filtros.</p>}
      <nav aria-label="Páginas de evidencias" className="mt-5 flex justify-between">{page > 1 ? <Link href={url(page - 1)} className="py-3 underline">Anterior</Link> : <span />}{page < pages && <Link href={url(page + 1)} className="py-3 underline">Siguiente</Link>}</nav>
    </SectionCard>
  </div>;
}
