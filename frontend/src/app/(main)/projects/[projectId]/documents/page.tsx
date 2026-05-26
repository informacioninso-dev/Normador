import { notFound } from "next/navigation";

import { uploadDocumentAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";

const documentTypes = [
  "POLITICA",
  "PROCEDIMIENTO",
  "FORMATO",
  "REGISTRO",
  "MATRIZ",
  "INFORME",
  "ACTA",
  "EVIDENCIA",
  "OTRO",
];

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const flash = decodeFlash(query);
  const projectId = Number(routeParams.projectId);

  if (!Number.isFinite(projectId)) {
    notFound();
  }

  const workspace = await getProjectWorkspace(projectId);

  if (!workspace.project) {
    notFound();
  }

  const returnPath = `/projects/${projectId}/documents`;

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Cargar documento"
        description="Sube el archivo y el sistema extrae el texto, genera chunks y embeddings automaticamente."
        action={
          <form action={uploadDocumentAction} className="space-y-3" encType="multipart/form-data">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Titulo (opcional)
              </label>
              <input name="title" placeholder="Procedimiento de control documental" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Tipo de documento
              </label>
              <select name="document_type" required defaultValue="PROCEDIMIENTO">
                {documentTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Requisito (opcional)
              </label>
              <select name="requirement" defaultValue="">
                <option value="">Sin requisito especifico</option>
                {workspace.requirements.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.clause} — {req.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Archivo (pdf, docx, xlsx, txt)
              </label>
              <input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt" required />
            </div>
            <SubmitButton label="Cargar y procesar" pendingLabel="Procesando..." className="w-full" />
          </form>
        }
      >
        <div className="space-y-3">
          {workspace.documents.length ? (
            workspace.documents.map((document) => (
              <article
                key={document.id}
                className="rounded-[26px] border border-black/8 bg-white/78 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {document.document_type} · {document.file_extension?.toUpperCase() || ""}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{document.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink/45">
                      {document.requirement_title || "Sin requisito"} ·{" "}
                      {formatDateTime(document.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={document.status} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Chunks</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{document.chunk_count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Archivo</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{document.file_name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Error</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {document.processing_error || "—"}
                    </p>
                  </div>
                </div>

                {document.extracted_text && (
                  <div className="mt-4 rounded-[18px] bg-sand/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      Texto extraido
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink/72">
                      {document.extracted_text.slice(0, 400)}
                      {document.extracted_text.length > 400 ? "…" : ""}
                    </p>
                  </div>
                )}
              </article>
            ))
          ) : (
            <EmptyState
              title="No hay documentos"
              description="Sube el primero para activar el flujo de revision normativa."
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
