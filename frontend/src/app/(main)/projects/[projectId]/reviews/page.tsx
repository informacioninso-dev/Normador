import { notFound } from "next/navigation";

import { runReviewAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { excerpt, formatDateTime } from "@/lib/presentation";

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

  const workspace = await getProjectWorkspace(projectId);

  if (!workspace.project) {
    notFound();
  }

  const returnPath = `/projects/${projectId}/reviews`;
  const readyDocuments = workspace.documents.filter((document) => document.status === "LISTO");

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Revision documental y normativa"
        description="Selecciona un documento listo y ejecuta la orquestacion completa: retrieval, prompt estructurado, evaluaciones, hallazgos y actualizacion de checklist."
        action={
          <form action={runReviewAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Documento listo
              </label>
              <select name="document" required defaultValue="">
                <option value="" disabled>
                  Selecciona documento
                </option>
                {readyDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Tipo de revision
              </label>
              <select name="review_type" defaultValue="CUMPLIMIENTO_NORMATIVO">
                {reviewTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton label="Ejecutar revision" pendingLabel="Revisando..." className="w-full" />
          </form>
        }
      >
        <div className="space-y-4">
          {workspace.reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[28px] border border-black/8 bg-white/78 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    {review.review_type} · {review.ai_model_used || "mock"}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{review.document_title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/72">{review.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={review.overall_status} />
                  <StatusBadge value={review.risk_level} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Fecha</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatDateTime(review.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Evaluaciones</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {review.requirement_evaluations.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Hallazgos</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{review.findings.length}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] bg-sand/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Evaluaciones
                  </p>
                  <div className="mt-3 space-y-3">
                    {review.requirement_evaluations.slice(0, 3).map((evaluation) => (
                      <div key={evaluation.id} className="rounded-[18px] bg-white/75 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {evaluation.clause} · {evaluation.requirement_title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-ink/72">
                              {excerpt(evaluation.recommendation || evaluation.gap)}
                            </p>
                          </div>
                          <StatusBadge value={evaluation.status} />
                        </div>
                      </div>
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
                              <p className="mt-2 text-sm leading-6 text-ink/72">
                                {excerpt(finding.description)}
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
          {!workspace.reviews.length ? (
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
