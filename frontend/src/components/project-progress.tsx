import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashBanner } from "@/components/flash-banner";
import { ProgressMatrix } from "@/components/progress-matrix";
import { ProcessingRefresh } from "@/components/processing-refresh";
import { getProjectHeader, getProjectWorkspace, decodeFlash } from "@/lib/api";
import { activeJobStates } from "@/lib/workflow";

export async function ProjectProgress({ projectId, query, report = false }: {
  projectId: number; query: Record<string, string | string[] | undefined>; report?: boolean;
}) {
  if (!Number.isSafeInteger(projectId) || projectId < 1) notFound();
  const [workspace, header] = await Promise.all([getProjectWorkspace(projectId, ["checklistItems", "documents", "reviews", "evidences", "actionPlans"]), getProjectHeader(projectId)]);
  const project = workspace.project;
  if (!project) notFound();
  const flash = decodeFlash(query);
  const jobs = workspace.documents.filter((d) => activeJobStates.includes(d.latest_job?.status || ""));
  const closed = workspace.checklistItems.filter((i) => i.status === "CERRADO").length;
  const pending = workspace.evidences.filter((e) => e.status === "CARGADA").length;
  const base = `/projects/${projectId}`;
  const processes = [...new Set(workspace.checklistItems.map((i) => i.process_area))];
  return <div className="space-y-5">
    <FlashBanner success={flash.success} error={flash.error || workspace.errors[0] || header.error} />
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{report ? "Informe de avance" : "Avance del proyecto"}</h1><div className="flex flex-wrap gap-2">{project.can_edit && <><Link href={`${base}/documents?view=upload`} className="ui-pill inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Cargar documento</Link><Link href={`${base}/document-control?view=new`} className="ui-pill inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Preparar documento</Link></>}<Link href={`/companies/${project.company}?view=branding`} className="ui-pill inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Logo y encabezado</Link></div></div>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Avance documental", header.summary ? `${header.summary.documentary_progress_percentage}%` : "No disponible"],
      ["Implementación real", header.summary ? `${header.summary.implementation_progress_percentage}%` : "No disponible"],
      ["Requisitos cerrados", `${closed} / ${workspace.checklistItems.length}`],
      ["Evidencias por validar", pending],
    ].map(([label, value]) => <div key={label} className="ui-surface rounded-2xl p-4"><dt className="text-sm text-ink/70">{label}</dt><dd className="mt-2 text-2xl font-bold">{value}</dd></div>)}</dl>
    {jobs.length > 0 && <div className="ui-muted flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2"><p role="status" className="text-sm">NORMAN está procesando {jobs.length} {jobs.length === 1 ? "documento" : "documentos"}.</p><Link href={`${base}/documents`} className="inline-flex min-h-11 items-center text-sm text-signal underline">Consultar procesamiento</Link><ProcessingRefresh active /></div>}
    <ProgressMatrix workspace={workspace} />
    <details className="ui-surface rounded-2xl p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Resumen por proceso</summary><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr>{["Proceso", "Requisitos", "Observados", "Implementados", "Cerrados"].map((h) => <th key={h} scope="col" className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink/10">{processes.map((area) => { const items = workspace.checklistItems.filter((i) => i.process_area === area); return <tr key={area}><th scope="row" className="px-3 py-3 font-normal">{area || "Sin proceso"}</th><td className="p-3">{items.length}</td>{["OBSERVADO", "IMPLEMENTADO", "CERRADO"].map((s) => <td key={s} className="p-3">{items.filter((i) => i.status === s).length}</td>)}</tr>; })}</tbody></table></div></details>
  </div>;
}
