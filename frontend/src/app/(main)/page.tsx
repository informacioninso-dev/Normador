import Link from "next/link";

import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { decodeFlash, getDashboardData } from "@/lib/api";
import { summarizePortfolio } from "@/lib/metrics";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const data = await getDashboardData();
  const portfolio = summarizePortfolio(data);

  const atRiskProjects = portfolio.projectSummaries
    .filter((item) => item.openPendingCount > 0 || item.documentaryProgress < 70)
    .sort((left, right) => right.openPendingCount - left.openPendingCount)
    .slice(0, 5);

  const urgentPlans = data.actionPlans
    .filter((plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard eyebrow="Proyectos" title="Activos" value={data.projects.length} />
        <StatCard
          eyebrow="Documental"
          title="Promedio"
          value={`${portfolio.documentaryProgress}%`}
        />
        <StatCard
          eyebrow="Implementacion"
          title="Promedio"
          value={`${portfolio.implementationProgress}%`}
          tone="ink"
        />
        <StatCard eyebrow="Pendientes" title="Abiertos" value={portfolio.openPendingCount} tone="accent" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard eyebrow="Empresas" title="Registradas" value={data.companies.length} />
        <StatCard eyebrow="Normas" title="Activas" value={data.standards.length} />
        <StatCard eyebrow="Documentos" title="Cargados" value={data.documents.length} />
        <StatCard eyebrow="Evidencia" title="Validada" value={portfolio.validatedEvidenceCount} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Portfolio"
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/companies"
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Empresas
              </Link>
              <Link
                href="/projects"
                className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
              >
                Proyectos
              </Link>
            </div>
          }
        >
          <div className="space-y-3">
            {portfolio.projectSummaries.length ? (
              portfolio.projectSummaries.map((item) => (
                <Link
                  key={item.project.id}
                  href={`/projects/${item.project.id}`}
                  className="grid gap-4 rounded-[24px] border border-black/8 bg-sand/75 p-4 transition hover:bg-sand"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3
                        className="text-xl font-bold text-ink"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {item.project.name}
                      </h3>
                      <p className="mt-1 text-sm text-ink/65">
                        {item.project.company_name} - {item.project.standard_name}
                      </p>
                    </div>
                    <StatusBadge value={item.project.status} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-moss">Documental</p>
                      <p className="mt-1 text-lg font-semibold">{item.documentaryProgress}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-moss">
                        Implementacion
                      </p>
                      <p className="mt-1 text-lg font-semibold">{item.implementationProgress}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-moss">Pendientes</p>
                      <p className="mt-1 text-lg font-semibold">{item.openPendingCount}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-moss">Evidencia</p>
                      <p className="mt-1 text-lg font-semibold">{item.validatedEvidenceCount}</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-sand/75 px-5 py-8 text-sm leading-6 text-ink/70">
                No hay proyectos.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="En foco">
            <div className="space-y-3">
              {atRiskProjects.length ? (
                atRiskProjects.map((item) => (
                  <Link
                    key={item.project.id}
                    href={`/projects/${item.project.id}/report`}
                    className="block rounded-[22px] border border-black/8 bg-white/70 p-4 transition hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">{item.project.name}</h3>
                        <p className="mt-1 text-sm text-ink/65">{item.project.standard_name}</p>
                      </div>
                      <StatusBadge
                        value={item.openPendingCount > 0 ? "OBSERVADO" : "EN_REVISION"}
                      />
                    </div>
                    <p className="mt-3 text-sm text-ink/70">
                      {item.documentaryProgress}% documental - {item.openPendingCount} pendientes
                      - {item.implementationProgress}% implementacion
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-ink/70">Sin alertas activas.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Pendientes">
            <div className="space-y-3">
              {urgentPlans.length ? (
                urgentPlans.map((plan) => (
                  <div key={plan.id} className="rounded-[22px] bg-sand/75 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{plan.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
                          {plan.project_name} - {plan.clause || "Sin clause"}
                        </p>
                      </div>
                      <StatusBadge value={plan.status} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-ink/72">
                      {plan.recommended_action || plan.description || "Sin accion sugerida."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-ink/70">Sin pendientes abiertos.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
