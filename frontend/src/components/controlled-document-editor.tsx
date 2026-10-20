"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateControlledDocumentAction } from "@/app/(main)/projects/[projectId]/document-control/actions";
import { DocumentDownloads } from "@/components/document-downloads";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import type { ControlledDocument, ControlledDocumentContent } from "@/lib/types";

export function ControlledDocumentEditor({ document, canEdit, canValidate }: { document: ControlledDocument; canEdit: boolean; canValidate: boolean }) {
  const revision = document.latest_revision;
  const [content, setContent] = useState<ControlledDocumentContent>(revision?.content ?? {});
  const router = useRouter();
  const [state, submit, pending] = useActionState(async (_previous: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> => {
    const result = await updateControlledDocumentAction(form);
    if (!result.error) {
      router.refresh();
      return { success: "Cambio guardado. El historial se ha conservado." };
    }
    return result;
  }, {});
  if (!revision) return <p>Este documento todavía no tiene una versión disponible.</p>;
  const blocked = pending || Boolean(document.archived_at);
  const hidden = <><input type="hidden" name="id" value={document.id} /><input type="hidden" name="expected_version" value={revision.number} /></>;
  return <div className="space-y-5">
    <SectionCard title={`${document.code} · ${document.title}`} description={`${document.kind} · ${document.process_area || "Sin proceso"} · Versión ${revision.number}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge value={document.archived_at ? "ARCHIVADO" : revision.status} /><DocumentDownloads document={document} revision={revision} /></div>
      {state.error && <p role="alert" className="mt-4 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 text-sm text-emerald-800">{state.success}</p>}
      {revision.source === "PLANTILLA" ? <form action={submit} className="mt-5 space-y-4">
        {hidden}<input type="hidden" name="operation" value="save" /><input type="hidden" name="content" value={JSON.stringify(content)} />
        <fieldset disabled={blocked || !canEdit} className="space-y-4">
          {content.sections?.map((section, index) => <div key={index}>
            <label htmlFor={`section-${index}`} className="mb-2 block font-semibold">{section.title}</label>
            <textarea id={`section-${index}`} value={section.text} onChange={(event) => setContent({ ...content, sections: content.sections?.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} />
          </div>)}
          {content.columns && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{content.columns.map((column, index) => <th key={index} className="p-2">{column}</th>)}</tr></thead><tbody>{content.rows?.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex} className="p-1"><input aria-label={`${content.columns?.[columnIndex]}, fila ${rowIndex + 1}`} value={cell} onChange={(event) => setContent({ ...content, rows: content.rows?.map((cells, index) => index === rowIndex ? cells.map((value, column) => column === columnIndex ? event.target.value : value) : cells) })} /></td>)}</tr>)}</tbody></table><button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => setContent({ ...content, rows: [...(content.rows ?? []), content.columns!.map(() => "")] })}>Añadir fila</button></div>}
          <div><label htmlFor="change-summary" className="mb-2 block text-sm font-semibold">Resumen de cambios</label><input id="change-summary" name="change_summary" required maxLength={3000} /></div>
          <button type="submit" className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Guardando..." : "Guardar nueva versión"}</button>
        </fieldset>
      </form> : <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{revision.extracted_text || "Descarga el archivo para consultar su contenido."}</p>}

      <details className="mt-6 border-t border-black/10 pt-4"><summary className="cursor-pointer font-semibold">Subir archivo corregido</summary>
        <form action={submit} className="mt-4 space-y-3">{hidden}<input type="hidden" name="operation" value="upload" />
          <fieldset disabled={blocked || !canEdit} className="space-y-3">
            <div><label htmlFor="revision-file" className="mb-2 block text-sm">{document.kind === "POE" ? "Archivo Word (.docx), máximo 10 MB" : "Archivo Excel (.xlsx), máximo 10 MB"}</label><input id="revision-file" name="file" type="file" required accept={document.kind === "POE" ? ".docx" : ".xlsx"} /></div>
            <div><label htmlFor="upload-summary" className="mb-2 block text-sm">Resumen de cambios</label><input id="upload-summary" name="change_summary" required /></div>
            <button className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Crear versión desde archivo</button>
          </fieldset>
        </form>
      </details>
    </SectionCard>

    <SectionCard title="Revisión y aprobación" description="Aprobar requiere revisión humana y un rol autorizado en esta empresa.">
      <form action={submit} className="space-y-4">{hidden}
        <div><label htmlFor="approval-notes" className="mb-2 block text-sm font-semibold">Notas de revisión</label><textarea id="approval-notes" name="notes" disabled={blocked || !(canEdit || canValidate)} /></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="confirmed" className="h-4 w-4" disabled={blocked || !canValidate} />He revisado esta versión y confirmo su aprobación.</label>
        <div className="flex flex-wrap gap-3">
          <button name="operation" value="submit" disabled={blocked || !canEdit || revision.status !== "BORRADOR"} className="rounded-xl bg-ink px-4 py-3 text-sm text-white disabled:opacity-40">Enviar a revisión</button>
          <button name="operation" value="approve" disabled={blocked || !canValidate || revision.status !== "EN_REVISION"} className="rounded-xl bg-ink px-4 py-3 text-sm text-white disabled:opacity-40">Aprobar versión</button>
          <button name="operation" value="return_to_draft" disabled={blocked || !canEdit || revision.status !== "EN_REVISION"} className="rounded-xl border border-black/15 px-4 py-3 text-sm disabled:opacity-40">Devolver a borrador</button>
        </div>
      </form>
    </SectionCard>
    <SectionCard title="Historial de versiones">
      <ul className="divide-y divide-black/10">{document.revisions.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong>Versión {item.number}</strong><p className="text-sm text-ink/80">{item.change_summary}</p><StatusBadge value={item.status} /></div><DocumentDownloads document={document} revision={item} /></li>)}</ul>
      <h3 className="mt-5 font-semibold">Registro de decisiones</h3><ul className="mt-3 space-y-2 text-sm">{document.events.map((event) => <li key={event.id}>{event.action} · {event.username || "Sistema"} · {event.notes}</li>)}</ul>
    </SectionCard>
  </div>;
}
