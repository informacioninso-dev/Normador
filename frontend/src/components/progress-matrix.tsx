"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/presentation";
import { requirementSupport } from "@/lib/workflow";
import type { ProjectWorkspace } from "@/lib/types";

export function ProgressMatrix({ workspace }: { workspace: ProjectWorkspace }) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const project = workspace.project!;
  const filtered = workspace.checklistItems.filter((item) => (!area || item.process_area === area) && (!status || item.status === status) && `${item.clause} ${item.title} ${item.requirement_title}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages);
  const start = (current - 1) * 20;
  return <section className="ui-surface min-w-0 rounded-3xl p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Matriz de avance</h2><a href={`/api/projects/${project.id}/report`} className="inline-flex min-h-11 items-center rounded-xl bg-signal px-4 text-sm font-semibold text-white">Descargar informe Excel</a></div>
    <div className="my-5 grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">Buscar requisito<input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cláusula o nombre" className="mt-2 min-h-11 w-full" /></label>
      <label className="text-sm font-semibold">Proceso<select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} className="mt-2 min-h-11 w-full"><option value="">Todos los procesos</option>{[...new Set(workspace.checklistItems.map((i) => i.process_area))].filter(Boolean).map((a) => <option key={a}>{a}</option>)}</select></label>
      <label className="text-sm font-semibold">Estado<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="mt-2 min-h-11 w-full"><option value="">Todos los estados</option>{[...new Set(workspace.checklistItems.map((i) => i.status))].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLocaleLowerCase("es")}</option>)}</select></label>
    </div>
    <p id="matrix-help" className="mb-3 text-sm text-ink/65">Abre un requisito para trabajar. En pantallas pequeñas, desliza la tabla para ver todas las columnas.</p>
    <div className="overflow-x-auto rounded-xl border border-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal" tabIndex={0} role="region" aria-label="Tabla de avance por requisito" aria-describedby="matrix-help">
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm"><caption className="sr-only">Avance documental y evidencia de implementación de {project.name}</caption><thead className="bg-ink text-white"><tr>{["Requisito / proceso", "Estado", "Documentos", "Última evaluación", "Evidencias validadas", "Acciones abiertas", "Fecha prevista"].map((h) => <th scope="col" key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink/10">
        {filtered.slice(start, start + 20).map((item) => {
          const support = requirementSupport(item, workspace.documents, workspace.reviews, workspace.evidences);
          const evaluation = support.reviews.find((r) => workspace.documents.some((d) => d.id === r.document && d.status !== "ARCHIVADO"))?.requirement_evaluations.find((e) => e.requirement === item.requirement);
          const docs = support.documents.filter((d) => d.status !== "ARCHIVADO");
          const validated = support.evidences.filter((e) => e.status === "VALIDADA").length;
          const actions = workspace.actionPlans.filter((p) => p.project === project.id && (p.requirement === item.requirement || p.checklist_item === item.id) && !["CERRADO", "SUPERSEDIDO"].includes(p.status));
          return <tr key={item.id} className="even:bg-sand/50 hover:bg-signal/5"><th scope="row" className="max-w-xs px-4 py-3 font-normal"><Link href={`/projects/${project.id}/checklist?item=${item.id}`} className="inline-flex min-h-11 items-center font-semibold text-signal underline">{item.clause} · {item.title || item.requirement_title}</Link><span className="block text-xs text-ink/65">{item.process_area || "Sin proceso"}</span></th><td className="px-4 py-3"><StatusBadge value={item.status} /></td><td className="px-4 py-3">{docs.length}</td><td className="px-4 py-3">{evaluation ? <StatusBadge value={evaluation.status} /> : "Sin revisión"}</td><td className="px-4 py-3"><Link href={`/projects/${project.id}/checklist?item=${item.id}&step=evidence`} className="inline-flex min-h-11 items-center text-signal underline">{validated} / {support.evidences.length}</Link></td><td className="px-4 py-3">{actions.length ? <Link href={`/projects/${project.id}/action-plans?requirement=${item.requirement}`} className="inline-flex min-h-11 items-center text-signal underline">{actions.length}</Link> : 0}</td><td className="px-4 py-3">{formatDate(item.due_date)}</td></tr>;
        })}
        {!filtered.length && <tr><td colSpan={7} className="p-6 text-center">{workspace.checklistItems.length ? "Ningún requisito coincide con estos filtros." : "Este proyecto todavía no tiene requisitos."}</td></tr>}
      </tbody></table>
    </div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p role="status">{filtered.length ? `${start + 1}–${Math.min(start + 20, filtered.length)} de ${filtered.length} requisitos` : "0 requisitos"}</p><div className="flex items-center gap-3"><button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="ui-pill min-h-11 rounded-xl px-4 disabled:opacity-40">Anterior</button><span>{current} / {pages}</span><button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="ui-pill min-h-11 rounded-xl px-4 disabled:opacity-40">Siguiente</button></div></div>
  </section>;
}
