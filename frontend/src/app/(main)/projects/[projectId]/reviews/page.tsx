import { FormField } from "@/components/form-field";
import { RoleForm } from "@/components/role-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProcessingRefresh } from "@/components/processing-refresh";

import { runReviewAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";
import { taskLabel } from "@/lib/workflow";

const reviewTypes = [
  "REVISION_DOCUMENTAL",
  "CUMPLIMIENTO_NORMATIVO",
  "CIERRE_NO_CONFORMIDAD",
  "PREPARACION_AUDITORIA",
  "IMPLEMENTACION",
];

export default async function ProjectReviewsPage({
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

  const workspace = await getProjectWorkspace(projectId, ["documents","reviews","checklistItems","requirements"]);

  if (!workspace.project) {
    notFound();
  }

  const returnPath = `/projects/${projectId}/reviews`;
  const readyDocuments = workspace.documents.filter((document) => document.status === "LISTO");
  const requirementId = typeof query.requirement === "string" ? query.requirement : "";
  const selectedDocument = readyDocuments.find((document) => String(document.id) === query.document);
  const visibleReviews = workspace.reviews.filter((review) => !requirementId || review.requirement_evaluations.some((result) => String(result.requirement) === requirementId));
  const selectedRequirement = workspace.checklistItems.find((item) => String(item.requirement) === requirementId);


  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Historial de revisiones documentales"
        description="Selecciona un documento para comprobar sus requisitos. NORMAN guardará las citas, los faltantes y los hallazgos; podrás consultar el estado sin esperar en esta pantalla."
        action={workspace.project.can_edit ? <details open={Boolean(selectedDocument)}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Solicitar una revisión documental</summary>
          <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={runReviewAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="all_requirement_ids" value={workspace.requirements.map((requirement) => requirement.id).join(",")} />
            <div>
              <FormField label={<>
                Documento listo
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><select name="document" required defaultValue={selectedDocument?.id ?? ""}>
                <option value="" disabled>
                  Selecciona documento
                </option>
                {readyDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select></FormField>
            </div>
            <div><FormField label="Requisito que quieres comprobar"><select name="requirement" required defaultValue={requirementId || selectedDocument?.requirement || ""}><option value="" disabled>Selecciona una cláusula o requisito</option><option value="all">Todos los requisitos de la norma ({workspace.requirements.length})</option>{workspace.requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.clause} · {requirement.title}</option>)}</select></FormField></div>
            <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Cambiar el objetivo de la revisión</summary>
              <FormField label={<>
                Tipo de revisión
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><select name="review_type" defaultValue="CUMPLIMIENTO_NORMATIVO">
                {reviewTypes.map((value) => (
                  <option key={value} value={value}>
                    {taskLabel(value)}
                  </option>
                ))}
              </select></FormField>
            </details>
            <SubmitButton label="Revisar el requisito seleccionado" pendingLabel="Revisando..." className="w-full" />
          </RoleForm></details> : undefined
        }
      >
        <div className="space-y-4">
          {selectedRequirement && <Link href={`/projects/${projectId}/checklist?item=${selectedRequirement.id}&step=review`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a la ficha de {selectedRequirement.clause} · {selectedRequirement.title}</Link>}
          {requirementId && <Link href={returnPath} className="ml-3 inline-flex min-h-11 items-center text-sm text-signal underline">Ver todas las revisiones del proyecto</Link>}
          {workspace.documents.filter((document) => document.latest_job?.operation === "REVIEW" || document.latest_job?.review_after_processing).map((document) => <div key={document.id} className="rounded-xl border border-black/15 p-4"><p role="status">{document.title} · {({ PENDING: "En cola", RUNNING: "Revisando", RETRY: "Reintentando", SUCCESS: "Revisión completada", FAILED: "No se completó la revisión" })[document.latest_job!.status]}</p>{document.latest_job?.error && <p role="alert">{document.latest_job.error}</p>}<ProcessingRefresh active={["PENDING", "RUNNING", "RETRY"].includes(document.latest_job!.status)} /></div>)}
          {visibleReviews.map((review) => (
            <article
              key={review.id}
              id={`review-${review.id}`}
              className="rounded-[28px] border border-black/8 bg-white/78 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    {review.review_type.replaceAll("_", " ")} · {review.provider || "Proveedor no registrado"} · {review.ai_model_used || "Modelo no registrado"} · {review.prompt_version}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{review.document_title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/70">{review.summary}</p>
                  <a className="mt-3 inline-flex min-h-11 items-center underline" href={`/api/files/documents/${review.document}`} target="_blank" rel="noopener noreferrer">Abrir documento revisado (nueva pestaña)</a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={review.overall_status} />
                  <StatusBadge value={review.risk_level} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Fecha</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatDateTime(review.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Evaluaciones</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {review.requirement_evaluations.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Hallazgos</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{review.findings.length}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] bg-sand/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Evaluaciones
                  </p>
                  <div className="mt-3 space-y-3">
                    {review.requirement_evaluations.map((evaluation) => (
                      <details key={evaluation.id} className="rounded-xl border border-black/15 bg-white p-3" open={review.requirement_evaluations.length === 1}>
                        <summary className="cursor-pointer py-2 font-semibold">{evaluation.clause} · {evaluation.requirement_title} · {evaluation.status.replaceAll("_", " ")}</summary>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {evaluation.clause} · {evaluation.requirement_title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-ink/70">
                              {evaluation.recommendation || evaluation.gap}
                            </p>
                          </div>
                          <StatusBadge value={evaluation.status} />
                        </div>
                        <div className="mt-4 space-y-3 break-words">
                          <div><h4 className="font-semibold">Evidencia citada en el documento</h4>{evaluation.evidence_found ? <blockquote className="mt-2 whitespace-pre-wrap rounded-xl bg-sand p-3">{evaluation.evidence_found}</blockquote> : <p>No se identificó una cita documental para esta evaluación.</p>}</div>
                          <p className="whitespace-pre-wrap"><strong>Brecha:</strong> {evaluation.gap || "Sin brecha indicada."}</p>
                          <p><strong>Riesgo:</strong> {evaluation.risk_level}</p>
                          <p><strong>Evidencia real requerida:</strong> {evaluation.requires_real_evidence ? "Sí. La validación documental por sí sola no cierra el requisito." : "Según las condiciones de cierre del requisito."}</p>
                          {evaluation.missing_documents_or_evidence.length > 0 && <div><h4 className="font-semibold">Documentos o evidencia que faltan</h4><ul className="list-disc pl-5">{evaluation.missing_documents_or_evidence.map((missing, index) => <li key={index}>{missing}</li>)}</ul></div>}
                          {evaluation.suggested_text && <details><summary className="cursor-pointer py-2 underline">Texto sugerido para revisión humana</summary><p className="whitespace-pre-wrap">{evaluation.suggested_text}</p></details>}
                          <Link href={`/projects/${projectId}/checklist?item=${workspace.checklistItems.find((item) => item.requirement === evaluation.requirement)?.id ?? ""}`} className="inline-flex min-h-11 items-center underline">Trabajar este requisito</Link>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="rounded-[22px] bg-sand/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Hallazgos
                  </p>
                  <div className="mt-3 space-y-3">
                    {review.findings.length ? (
                      review.findings.map((finding) => (
                        <div key={finding.id} className="rounded-[18px] bg-white/75 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {finding.requirement_title || finding.finding_type}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-ink/70">
                                {finding.description}
                              </p>
                            </div>
                            <StatusBadge value={finding.finding_type} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-ink/70">
                        Esta revision no genero hallazgos.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!visibleReviews.length ? (
            <EmptyState
              title="Sin revisiones ejecutadas"
              description="Cuando haya documentos en estado LISTO podras disparar revisiones desde esta misma vista."
            />
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
