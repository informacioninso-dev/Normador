import { notFound } from "next/navigation";

import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { groupChecklistByArea, summarizeProject } from "@/lib/metrics";
import { formatDate } from "@/lib/presentation";

export default async function ProjectReportPage({
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
  const groupedAreas = groupChecklistByArea(workspace.checklistItems);

  const findingsByType = workspace.findings.reduce(
    (acc, finding) => {
      acc[finding.finding_type] = (acc[finding.finding_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          eyebrow="Documental"
          title="Avance"
          value={`${summary.documentaryProgress}%`}
        />
        <StatCard
          eyebrow="Implementacion"
          title="Avance"
          value={`${summary.implementationProgress}%`}
          tone="ink"
        />
        <StatCard
          eyebrow="Requisitos"
          title="Cerrados"
          value={`${summary.closedRequirementsCount}/${summary.totalRequirements}`}
        />
        <StatCard
          eyebrow="Pendientes"
          title="Abiertos"
          value={summary.openPendingCount}
          tone="accent"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard eyebrow="Horas registradas" value={workspace.worklogs.reduce((sum, entry) => sum + Number(entry.logged_hours), 0).toFixed(2)} />
        <StatCard eyebrow="Horas facturables" value={workspace.worklogs.reduce((sum, entry) => sum + Number(entry.billable_hours), 0).toFixed(2)} />
        <StatCard eyebrow="Horas aprobadas" value={workspace.worklogs.reduce((sum, entry) => sum + Number(entry.approved_hours), 0).toFixed(2)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Datos del proyecto">
          <div className="space-y-3">
            {[
              ["Empresa", workspace.project.company_name],
              ["Norma", workspace.project.standard_name],
              ["Estado", workspace.project.status],
              ["Inicio", formatDate(workspace.project.start_date)],
              ["Meta", formatDate(workspace.project.target_date)],
              ["Alcance", workspace.project.scope],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 rounded-[18px] bg-sand/75 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">{label}</p>
                <p className="text-sm font-semibold text-ink text-right">{value || "—"}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Hallazgos por tipo">
          {Object.keys(findingsByType).length ? (
            <div className="space-y-3">
              {Object.entries(findingsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-[18px] bg-white/75 px-4 py-3">
                  <StatusBadge value={type} />
                  <p className="text-sm font-semibold text-ink">{count}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/70">Sin hallazgos registrados.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Avance por proceso">
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedAreas).map(([area, items]) => {
            const closed = items.filter((item) => item.status === "CERRADO").length;
            const implemented = items.filter((item) => item.status === "IMPLEMENTADO").length;
            const observed = items.filter((item) => item.status === "OBSERVADO").length;
            const pct = Math.round((closed / items.length) * 100);

            return (
              <div key={area} className="rounded-[24px] border border-black/8 bg-white/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">{area}</h3>
                  <span className="rounded-full bg-signal/10 px-3 py-1 text-sm font-semibold text-signal">
                    {pct}%
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-[16px] bg-sand/75 p-3 text-center">
                    <p className="text-lg font-bold text-ink">{closed}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-moss">Cerrados</p>
                  </div>
                  <div className="rounded-[16px] bg-sand/75 p-3 text-center">
                    <p className="text-lg font-bold text-ink">{implemented}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-moss">Impl.</p>
                  </div>
                  <div className="rounded-[16px] bg-sand/75 p-3 text-center">
                    <p className="text-lg font-bold text-ink">{observed}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-moss">Obs.</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Ultimas revisiones">
        <div className="space-y-3">
          {workspace.reviews.slice(0, 5).map((review) => (
            <div key={review.id} className="rounded-[22px] bg-sand/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{review.document_title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
                    {review.review_type} · {review.ai_model_used || "mock"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge value={review.overall_status} />
                  <StatusBadge value={review.risk_level} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/72">{review.summary}</p>
            </div>
          ))}
          {!workspace.reviews.length && (
            <p className="text-sm text-ink/70">Sin revisiones ejecutadas.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Registro diario">
        <div className="space-y-3">
          {workspace.worklogs.slice(0, 5).map((entry) => (
            <div key={entry.id} className="rounded-[22px] bg-sand/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{entry.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
                    {entry.consultant_username} · {formatDate(entry.work_date)} · {entry.activity_type}
                  </p>
                </div>
                <StatusBadge value={entry.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/72">{entry.summary || "Sin detalle."}</p>
            </div>
          ))}
          {!workspace.worklogs.length && (
            <p className="text-sm text-ink/70">Sin jornadas registradas.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
