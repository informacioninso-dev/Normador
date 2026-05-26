import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { groupChecklistByArea, summarizeProject } from "@/lib/metrics";
import { excerpt, formatDateTime } from "@/lib/presentation";

function buildNextAction(
  projectId: number,
  workspace: Awaited<ReturnType<typeof getProjectWorkspace>>,
) {
  const openPlans = workspace.actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );
  const pendingEvidence = workspace.checklistItems.filter(
    (item) => item.status === "VALIDADO_DOCUMENTALMENTE" && item.requires_real_evidence,
  );

  if (!workspace.documents.length) {
    return {
      title: "Sube el primer documento",
      detail: "Empieza por el soporte base del requisito o proceso mas critico.",
      href: `/projects/${projectId}/documents`,
      cta: "Ir a documentos",
    };
  }

  if (!workspace.reviews.length) {
    return {
      title: "Ejecuta la primera revision",
      detail: "Ya hay documentos. Ahora toca revisar y generar hallazgos.",
      href: `/projects/${projectId}/reviews`,
      cta: "Ir a revisiones",
    };
  }

  if (openPlans.length) {
    return {
      title: "Atiende pendientes abiertos",
      detail: `${openPlans.length} plan(es) siguen sin cierre.`,
      href: `/projects/${projectId}/action-plans`,
      cta: "Ir a pendientes",
    };
  }

  if (pendingEvidence.length) {
    return {
      title: "Carga evidencia real",
      detail: `${pendingEvidence.length} item(s) ya tienen soporte documental pero aun requieren evidencia validada.`,
      href: `/projects/${projectId}/evidence`,
      cta: "Ir a evidencia",
    };
  }

  return {
    title: "Revisa el reporte",
    detail: "El proyecto ya no tiene bloqueos obvios. Valida el estado final.",
    href: `/projects/${projectId}/report`,
    cta: "Ver reporte",
  };
}

export default async function ProjectOverviewPage({
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

  const summary = summarizeProject(workspace.project, workspace);
  const latestReview = workspace.reviews[0];
  const groupedAreas = groupChecklistByArea(workspace.checklistItems);
  const mostLoadedArea = Object.entries(groupedAreas)
    .map(([area, items]) => ({
      area,
      open: items.filter((item) => item.status !== "CERRADO").length,
      total: items.length,
    }))
    .sort((left, right) => right.open - left.open)[0];
  const nextAction = buildNextAction(projectId, workspace);
  const openPlans = workspace.actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Siguiente accion" description="Haz esto antes que otra cosa.">
          <div className="rounded-[24px] border border-black/8 bg-sand/76 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Recomendado
            </p>
            <h3
              className="mt-2 text-2xl font-bold text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {nextAction.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink/72">{nextAction.detail}</p>
            <Link
              href={nextAction.href}
              className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand transition hover:bg-ink/92"
            >
              {nextAction.cta}
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="Estado" description="Lectura rapida del proyecto.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] bg-sand/75 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-moss">Ultima revision</p>
              {latestReview ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <StatusBadge value={latestReview.overall_status} />
                    <StatusBadge value={latestReview.risk_level} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-ink/75">{latestReview.summary}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink/45">
                    {latestReview.document_title} - {formatDateTime(latestReview.created_at)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink/70">
                  Todavia no hay revisiones ejecutadas.
                </p>
              )}
            </div>

            <div className="rounded-[24px] bg-white/78 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-moss">Proceso mas cargado</p>
              {mostLoadedArea ? (
                <>
                  <h3
                    className="mt-3 text-2xl font-bold text-ink"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {mostLoadedArea.area}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink/72">
                    {mostLoadedArea.open} abiertos de {mostLoadedArea.total}.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink/70">No hay items en checklist.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Pendientes abiertos" description="Planes que siguen sin cierre.">
        <div className="space-y-3">
          {openPlans.slice(0, 3).map((plan) => (
            <div key={plan.id} className="rounded-[22px] bg-sand/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{plan.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
                    {plan.clause || "Sin clause"} - {plan.requirement_title || "Sin requisito"}
                  </p>
                </div>
                <StatusBadge value={plan.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/72">
                {plan.recommended_action || plan.description}
              </p>
            </div>
          ))}
          {!openPlans.length ? (
            <EmptyState
              title="Sin pendientes abiertos"
              description="Si aparece una brecha, la veras aqui."
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Checklist por área" description="Vista compacta del avance por proceso.">
        {Object.keys(groupedAreas).length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(groupedAreas).map(([area, items]) => {
              const closed = items.filter((item) => item.status === "CERRADO").length;
              const open = items.length - closed;

              return (
                <div key={area} className="rounded-[24px] border border-black/8 bg-white/75 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{area}</h3>
                      <p className="mt-1 text-sm text-ink/65">
                        {closed} cerrados - {open} abiertos
                      </p>
                    </div>
                    <div className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {Math.round((closed / items.length) * 100)}%
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {items.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-[18px] bg-sand/75 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {item.clause} - {item.title}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
                              {item.required_document_type} - {item.required_evidence_type}
                            </p>
                          </div>
                          <StatusBadge value={item.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Checklist vacio" description="Revisa la norma o regenera el checklist." />
        )}
      </SectionCard>

      <SectionCard title="Documentos recientes" description="Soporte listo para revisar.">
        <div className="space-y-3">
          {workspace.documents.slice(0, 4).map((document) => (
            <Link
              key={document.id}
              href={`/projects/${projectId}/documents`}
              className="block rounded-[22px] bg-sand/75 p-4 transition hover:bg-sand"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{document.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
                    {document.document_type} - {document.requirement_title || "Sin requisito"}
                  </p>
                </div>
                <StatusBadge value={document.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/72">
                {excerpt(document.extracted_text)}
              </p>
            </Link>
          ))}
          {!workspace.documents.length ? (
            <EmptyState
              title="No hay documentos"
              description="Carga el primero para activar revision y trazabilidad."
            />
          ) : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Requisitos cerrados", value: `${summary.closedRequirementsCount} / ${summary.totalRequirements}` },
          { label: "Pendientes abiertos", value: summary.openPendingCount, highlight: summary.openPendingCount > 0 },
          { label: "Docs. observados", value: summary.observedDocumentsCount },
          { label: "Evidencia validada", value: summary.validatedEvidenceCount },
        ].map((item) => (
          <div
            key={item.label}
            className={[
              "rounded-[22px] border border-black/8 px-4 py-4",
              item.highlight ? "bg-signal/8" : "bg-white/80",
            ].join(" ")}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{item.label}</p>
            <p className={["mt-1.5 text-2xl font-bold", item.highlight ? "text-signal" : "text-ink"].join(" ")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
