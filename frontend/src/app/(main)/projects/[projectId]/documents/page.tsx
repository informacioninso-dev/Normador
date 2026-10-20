import Link from "next/link";
import { notFound } from "next/navigation";
import { reprocessDocumentAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { DocumentIntakeForm } from "@/components/document-intake-form";
import { FlashBanner } from "@/components/flash-banner";
import { ProcessingRefresh } from "@/components/processing-refresh";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";
import { activeJobStates, taskLabel } from "@/lib/workflow";

export default async function ProjectDocumentsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ projectId: rawId }, query] = await Promise.all([params, searchParams]);
  const projectId = Number(rawId);
  if (!Number.isSafeInteger(projectId) || projectId < 1) notFound();
  const workspace = await getProjectWorkspace(projectId, ["requirements", "documents", "checklistItems"], true);
  if (!workspace.project) notFound();
  const project = workspace.project;
  const flash = decodeFlash(query), path = `/projects/${projectId}/documents`;
  const intake = query.view === "upload";
  const search = typeof query.q === "string" ? query.q.trim().toLocaleLowerCase("es") : "";
  const documents = workspace.documents.filter((document) => `${document.title} ${document.requirement_title}`.toLocaleLowerCase("es").includes(search)).sort((a, b) => Number(String(b.id) === query.document) - Number(String(a.id) === query.document));
  return <div className="space-y-5">
    <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />
    {intake ? <SectionCard title="Revisar un documento que ya tienes" description="Selecciona el archivo y el requisito que quieres comprobar. NORMAN guardará el soporte y preparará su revisión." action={<Link href={path} className="inline-flex min-h-11 items-center text-sm text-signal underline">Volver a los documentos</Link>}>
      {project.can_edit ? <DocumentIntakeForm projectId={projectId} requirements={workspace.requirements} /> : <p className="text-sm text-ink/70">La carga y la solicitud de revisión corresponden al responsable o implementador de la empresa.</p>}
    </SectionCard> : <SectionCard title="Documentos del proyecto" description="Consulta los archivos y continúa con el requisito al que pertenecen." action={project.can_edit ? <Link href={`${path}?view=upload`} className="inline-flex min-h-11 items-center rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-white">Cargar un documento existente</Link> : undefined}>
      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><label htmlFor="document-search" className="mb-2 block text-sm font-semibold">Buscar documento o requisito</label><input id="document-search" name="q" type="search" defaultValue={typeof query.q === "string" ? query.q : ""} /></div><button type="submit" className="min-h-11 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Buscar</button></form>
      <div className="divide-y divide-ink/10">{documents.map((document) => {
        const item = workspace.checklistItems.find((candidate) => candidate.id === document.checklist_item || candidate.requirement === document.requirement);
        const job = document.latest_job;
        const active = activeJobStates.includes(job?.status ?? "");
        return <article key={document.id} id={`document-${document.id}`} className="space-y-3 py-5 scroll-mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="break-words text-lg font-semibold">{document.title}</h3><StatusBadge value={document.status} /></div>
          <p className="text-sm text-ink/70">{taskLabel(document.document_type)} · {formatDateTime(document.uploaded_at)}</p><p className="text-sm">{document.requirement_title || "Documento guardado sin requisito asociado"}</p>
          {job && <div className="rounded-xl bg-sand p-3"><p role="status" className="text-sm font-semibold">{({ PENDING: "En espera para procesar", RUNNING: "NORMAN está procesando este documento", RETRY: "Se está reintentando el procesamiento", SUCCESS: job.operation === "REVIEW" || job.review_after_processing ? "Procesamiento y revisión completados" : "Documento preparado para revisar", FAILED: "El procesamiento no se completó" })[job.status]}</p>{job.error && <p role="alert" className="mt-2 text-sm">{job.error}</p>}<ProcessingRefresh active={active} /></div>}
          <div className="flex flex-wrap gap-4"><a href={`/api/files/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Abrir archivo (nueva pestaña)</a>{item ? <Link href={`/projects/${projectId}/checklist?item=${item.id}&step=${active ? "documents" : "review"}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">{active ? "Abrir ficha del requisito" : "Ver resultado y continuar con el requisito"}</Link> : document.status === "LISTO" && <Link href={`/projects/${projectId}/reviews?document=${document.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Elegir un requisito para revisar</Link>}</div>
          {(document.status === "FALLIDO" || job?.status === "FAILED") && project.can_edit && !active && <ActionForm action={reprocessDocumentAction}><input type="hidden" name="document" value={document.id} /><input type="hidden" name="return_path" value={`${path}?document=${document.id}`} /><SubmitButton label="Reintentar procesamiento" pendingLabel="Solicitando reintento..." /></ActionForm>}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-ink/70">Consultar el texto extraído y los datos de procesamiento</summary><p className="text-sm text-ink/70">{document.chunk_count} fragmentos de texto preparados · {document.file_name}</p><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-sand p-3 text-sm">{document.extracted_text || "Todavía no hay texto extraído disponible."}</pre></details>
        </article>;
      })}</div>
      {!documents.length && <p className="py-5 text-sm text-ink/70">{search ? "No hay coincidencias para esa búsqueda." : "Todavía no hay documentos. Puedes cargar uno existente o empezar por los criterios de un requisito."}</p>}
      <Link href={`/projects/${projectId}/checklist`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Trabajar desde los requisitos</Link>
    </SectionCard>}
  </div>;
}
