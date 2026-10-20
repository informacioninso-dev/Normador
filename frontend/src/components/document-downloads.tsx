import type { ControlledDocument, DocumentRevision } from "@/lib/types";

export function DocumentDownloads({ document, revision }: { document: ControlledDocument; revision: DocumentRevision }) {
  const base = `/api/controlled-documents/${document.id}/download?version=${revision.number}`;
  const formats = revision.source === "PLANTILLA" ? ["docx", "pdf", ...(document.kind !== "POE" ? ["xlsx"] : [])] : [];
  return <div className="flex flex-wrap gap-2" aria-label={`Descargar versión ${revision.number}`}>
    {formats.length ? formats.map((format) => <a key={format} href={`${base}&format=${format}`} className="ui-pill inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{format === "docx" ? "Word" : format.toUpperCase()}</a>) : <a href={base} className="inline-flex min-h-11 items-center text-sm font-semibold underline">Descargar archivo original</a>}
  </div>;
}
