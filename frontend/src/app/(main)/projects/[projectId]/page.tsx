import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { groupChecklistByArea, summarizeProject } from "@/lib/metrics";
import type { ActionPlan, ChecklistItem } from "@/lib/types";

type ImplementationView = "areas" | "estado" | "pendientes";

const implementationViews: Array<{ key: ImplementationView; label: string }> = [
  { key: "areas", label: "Areas" },
  { key: "estado", label: "Estado" },
  { key: "pendientes", label: "Pendientes" },
];

const checklistStatuses = [
  "NO_INICIADO",
  "PENDIENTE_DOCUMENTAL",
  "EN_REVISION",
  "OBSERVADO",
  "CUMPLE_PARCIAL",
  "VALIDADO_DOCUMENTALMENTE",
  "IMPLEMENTADO",
  "CERRADO",
];

function selectedView(value?: string | string[]): ImplementationView {
  const raw = Array.isArray(value) ? value[0] : value;
  return implementationViews.some((view) => view.key === raw)
    ? (raw as ImplementationView)
    : "areas";
}

function progressFor(items: ChecklistItem[]) {
  if (!items.length) {
    return 0;
  }

  const closed = items.filter((item) => item.status === "CERRADO").length;
  return Math.round((closed / items.length) * 100);
}

function ChecklistCard({ item }: { item: ChecklistItem }) {
  return (
    <Link
      href={`/projects/${item.project}/checklist`}
      className="ui-card block rounded-[14px] p-3 transition hover:bg-[#f7faff]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {item.clause} - {item.title}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink/45">
            {item.process_area}
          </p>
        </div>
        <StatusBadge value={item.status} className="shrink-0" />
      </div>
    </Link>
  );
}

function AreaBoard({ groupedAreas }: { groupedAreas: Record<string, ChecklistItem[]> }) {
  const entries = Object.entries(groupedAreas);

  if (!entries.length) {
    return <EmptyState title="Checklist vacio" description="Sin requisitos cargados." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {entries.map(([area, items]) => (
        <section key={area} className="ui-panel rounded-[18px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-ink">{area}</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
                {items.length} requisitos
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
              {progressFor(items)}%
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <ChecklistCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusBoard({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {checklistStatuses.map((status) => {
        const statusItems = items.filter((item) => item.status === status);

        return (
          <section key={status} className="ui-panel rounded-[18px] p-4">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge value={status} />
              <span className="text-sm font-semibold text-ink/60">{statusItems.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {statusItems.length ? (
                statusItems.map((item) => <ChecklistCard key={item.id} item={item} />)
              ) : (
                <div className="ui-muted rounded-[14px] border-dashed p-4 text-sm text-ink/60">
                  Sin items.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PendingBoard({
  projectId,
  openPlans,
}: {
  projectId: number;
  openPlans: ActionPlan[];
}) {
  if (!openPlans.length) {
    return <EmptyState title="Sin pendientes abiertos" description="Sin planes activos." />;
  }

  return (
    <div className="grid gap-3">
      {openPlans.map((plan) => (
        <Link
          key={plan.id}
          href={`/projects/${projectId}/action-plans`}
          className="ui-card grid gap-3 rounded-[18px] p-4 transition hover:bg-[#f7faff] md:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="text-sm font-semibold text-ink">{plan.title}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
              {plan.clause || "Sin clausula"} - {plan.requirement_title || "Sin requisito"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <StatusBadge value={plan.risk_level} />
            <StatusBadge value={plan.status} />
          </div>
        </Link>
      ))}
    </div>
  );
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
  const activeView = selectedView(query.view);
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
  const openPlans = workspace.actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );

  const kpis = [
    { label: "Documental", value: `${summary.documentaryProgress}%` },
    { label: "Implementacion", value: `${summary.implementationProgress}%` },
    { label: "Pendientes", value: summary.openPendingCount },
    { label: "Evidencia", value: summary.validatedEvidenceCount },
  ];

  const shortcuts = [
    { label: "Checklist", href: `/projects/${projectId}/checklist`, value: `${summary.closedRequirementsCount}/${summary.totalRequirements}` },
    { label: "Documentos", href: `/projects/${projectId}/documents`, value: workspace.documents.length },
    { label: "Revisiones", href: `/projects/${projectId}/reviews`, value: workspace.reviews.length },
    { label: "Seguimiento", href: `/projects/${projectId}/tracking`, value: workspace.implementationActivities.length },
    { label: "Evidencia", href: `/projects/${projectId}/evidence`, value: workspace.evidences.length },
    { label: "Informe", href: `/projects/${projectId}/report`, value: "Ver" },
  ];

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="ui-card rounded-[18px] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {shortcuts.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="ui-muted rounded-[18px] px-4 py-3 transition hover:bg-[#edf3ff]"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-ink">{item.value}</p>
          </Link>
        ))}
      </section>

      <SectionCard
        title="Implementacion"
        action={
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {implementationViews.map((view) => (
              <Link
                key={view.key}
                href={`/projects/${projectId}?view=${view.key}`}
                className={[
                  "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                  activeView === view.key
                    ? "ui-pill-active"
                    : "ui-pill text-ink hover:bg-[#edf3ff]",
                ].join(" ")}
              >
                {view.label}
              </Link>
            ))}
          </div>
        }
      >
        {activeView === "areas" ? <AreaBoard groupedAreas={groupedAreas} /> : null}
        {activeView === "estado" ? <StatusBoard items={workspace.checklistItems} /> : null}
        {activeView === "pendientes" ? (
          <PendingBoard projectId={projectId} openPlans={openPlans} />
        ) : null}
      </SectionCard>
    </div>
  );
}
