import { FormField } from "@/components/form-field";
import { RoleForm } from "@/components/role-form";
import { notFound } from "next/navigation";

import { uploadDocumentAction, reprocessDocumentAction } from "@/app/actions";
import { ProcessingRefresh } from "@/components/processing-refresh";
import { NormanAvatar } from "@/components/norman-avatar";
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

  const workspace = await getProjectWorkspace(projectId, ["requirements","documents"], true);

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
          <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={uploadDocumentAction} className="space-y-3" encType="multipart/form-data">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />
            <div>
              <FormField label={<>
                Titulo (opcional)
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="title" placeholder="Procedimiento de control documental" /></FormField>
            </div>
            <div>
              <FormField label={<>
                Tipo de documento
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><select name="document_type" required defaultValue="PROCEDIMIENTO">
                {documentTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select></FormField>
            </div>
            <div>
              <FormField label={<>
                Requisito (opcional)
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><select name="requirement" defaultValue="">
                <option value="">Sin requisito especifico</option>
                {workspace.requirements.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.clause} — {req.title}
                  </option>
                ))}
              </select></FormField>
            </div>
            <div>
              <FormField label={<>
                Archivo (pdf, docx, xlsx, txt)
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt" required /></FormField>
            </div>
            <SubmitButton label="Cargar y procesar" pendingLabel="Procesando..." className="w-full" />
          </RoleForm>
        }
      >
        <div className="space-y-3">
          {workspace.documents.length ? (
            workspace.documents.map((document) => (
              <article
                key={document.id}
                id={`document-${document.id}`}
                className="rounded-[26px] border border-black/8 bg-white/78 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {document.document_type} · {document.file_extension?.toUpperCase() || ""}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{document.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink/70">
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
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Chunks</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{document.chunk_count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Archivo</p>
                    <a href={document.file} className="mt-1 inline-block text-sm font-semibold text-moss underline underline-offset-4">{document.file_name}</a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Error</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {document.latest_job?.error || document.processing_error || "—"}
                    </p>
                  </div>
                </div>

                {document.latest_job && (
                  <div className="mt-4 flex items-center gap-2.5" role="status">
                    <NormanAvatar className="h-9 w-9" mood={document.latest_job.status === "FAILED" ? "attention" : document.latest_job.status === "SUCCESS" ? "ready" : "working"} />
                    <p className="text-sm text-ink">
                      <span className="font-semibold">NORMAN</span> · {({ PENDING: "En cola", RUNNING: "Procesando documento", RETRY: "Reintentando procesamiento", SUCCESS: "Procesamiento completado", FAILED: "No se pudo completar el procesamiento" })[document.latest_job.status]}
                      {document.latest_job.attempts > 1 ? ` · Intento ${document.latest_job.attempts}` : ""}
                    </p>
                  </div>
                )}
                <ProcessingRefresh active={Boolean(document.latest_job && ["PENDING", "RUNNING", "RETRY"].includes(document.latest_job.status))} />
                {document.latest_job?.status === "FAILED" && workspace.project?.can_edit && (
                  <RoleForm allowed action={reprocessDocumentAction} className="mt-3">
                    <input type="hidden" name="return_path" value={returnPath} />
                    <input type="hidden" name="document" value={document.id} />
                    <SubmitButton label="Reintentar procesamiento" pendingLabel="Solicitando..." />
                  </RoleForm>
                )}
                {document.extracted_text && (
                  <div className="mt-4 rounded-[18px] bg-sand/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      Texto extraido
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink/70">
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
