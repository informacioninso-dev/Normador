import { Download, FileText, Plus } from "lucide-react";
import Link from "next/link";

import { FlashBanner } from "@/components/flash-banner";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, safeApiGet } from "@/lib/api";
import type { ControlledDocument, StandardRequirement, Project } from "@/lib/types";

import { createControlledDocumentAction } from "./actions";

export default async function DocumentControlPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const flash = decodeFlash(query);
  const [projectResult, records] = await Promise.all([
    safeApiGet<Project | null>(`/api/projects/${projectId}/`, null),
    safeApiGet<ControlledDocument[]>("/api/controlled-documents/", [], { project: projectId }),
  ]);
  const project = projectResult.data;
  const requirements = project
    ? await safeApiGet<StandardRequirement[]>("/api/requirements/", [], { standard: project.standard })
    : { data: [] as StandardRequirement[], error: undefined };
  const documents = records.data;
  const active = documents.filter((doc) => !doc.archived_at);
  return (
    <div className="document-control space-y-6">
      <FlashBanner error={flash.error || records.error || requirements.error} success={flash.success} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Control documental</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
            <span>{active.length} documentos activos</span>
            <span>{active.filter((doc) => doc.current_revision).length} vigentes</span>
            <span>{documents.length - active.length} archivados</span>
          </div>
        </div>
        <Link href={`/projects/${projectId}/documents`} className="flex items-center gap-2 text-sm font-medium text-signal">
          <FileText size={17} /> Archivos del proyecto
        </Link>
      </header>

      <details open={!documents.length} className="border-b border-stone-200 pb-5">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-800">
          <Plus size={18} /> Nuevo documento
        </summary>
        <form action={createControlledDocumentAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="project" value={projectId} />
          <label className="dc-label">Tipo
            <select name="kind" defaultValue="POE" required>
              <option value="POE">POE - Word</option>
              <option value="MATRIZ">Matriz - Excel</option>
              <option value="FORMATO">Formato - Excel</option>
            </select>
          </label>
          <label className="dc-label">Codigo
            <input name="code" placeholder="POE-001" maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,63}" required />
          </label>
          <label className="dc-label">Titulo
            <input name="title" placeholder="Procedimiento de recepcion" maxLength={255} required />
          </label>
          <label className="dc-label md:col-span-2">Requisito asociado
            <select name="requirement" defaultValue="">
              <option value="">Sin requisito especifico</option>
              {requirements.data.map((req) => <option key={req.id} value={req.id}>{req.clause} - {req.title}</option>)}
            </select>
          </label>
          <label className="dc-label">Proceso
            <input name="process_area" placeholder="Recepcion" maxLength={120} />
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <SubmitButton label="Crear borrador" pendingLabel="Generando..." className="!rounded-md !bg-emerald-800 !text-white !py-2" />
          </div>
        </form>
      </details>

      <div className="overflow-x-auto">
        <table className="dc-table w-full min-w-[660px] text-left text-sm">
          <thead><tr>
            <th>Documento</th><th>Tipo / Proceso</th><th>Ultima version</th><th>Vigente</th><th><span className="sr-only">Descargar</span></th>
          </tr></thead>
          <tbody>
            {documents.map((doc) => <tr key={doc.id}>
              <td className="max-w-[320px]">
                <Link href={`/projects/${projectId}/document-control/${doc.id}`} className="block font-semibold text-emerald-800 hover:underline">{doc.code}</Link>
                <span className="mt-1 block break-words text-stone-700">{doc.title}</span>
                {doc.clause && <span className="mt-1 block text-xs text-stone-500">Requisito {doc.clause}</span>}
              </td>
              <td>{doc.kind}<span className="mt-1 block text-xs text-stone-500">{doc.process_area || "Sin proceso"}</span></td>
              <td><span className="mr-2">v{String(doc.latest_revision?.number ?? 1).padStart(2, "0")}</span><StatusBadge value={doc.archived_at ? "ARCHIVADO" : doc.latest_revision?.status ?? "BORRADOR"} /></td>
              <td>{doc.current_revision ? `v${String(doc.current_revision.number).padStart(2, "0")}` : "Pendiente"}</td>
              <td>{doc.latest_revision && <a className="dc-icon-button" href={`/api/controlled-documents/${doc.id}/download?version=${doc.latest_revision.number}`} title="Descargar ultima version" aria-label={`Descargar ${doc.code}`}><Download size={17} /></a>}</td>
            </tr>)}
            {!documents.length && <tr><td colSpan={5} className="py-10 text-center text-stone-500">Sin POE, matrices o formatos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
