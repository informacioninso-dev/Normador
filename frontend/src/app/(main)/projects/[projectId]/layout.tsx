import { notFound } from "next/navigation";

import { ProjectTabs } from "@/components/project-tabs";
import { StatusBadge } from "@/components/status-badge";
import { getProjectWorkspace } from "@/lib/api";
import { summarizeProject } from "@/lib/metrics";
import { formatDate } from "@/lib/presentation";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const routeParams = await params;
  const projectId = Number(routeParams.projectId);

  if (!Number.isFinite(projectId)) {
    notFound();
  }

  const workspace = await getProjectWorkspace(projectId);

  if (!workspace.project) {
    notFound();
  }

  const summary = summarizeProject(workspace.project, workspace);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-black/8 bg-[linear-gradient(150deg,rgba(255,255,255,0.92),rgba(244,239,230,0.88))] px-5 pt-5 pb-0 shadow-[0_18px_50px_rgba(14,20,32,0.08)]">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
                {workspace.project.company_name}
              </span>
              <StatusBadge value={workspace.project.status} />
            </div>
            <h1
              className="mt-1.5 text-3xl font-bold leading-tight text-ink md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {workspace.project.name}
            </h1>
            {workspace.project.scope && (
              <p className="mt-1 text-sm leading-6 text-ink/60 line-clamp-2">
                {workspace.project.scope}
              </p>
            )}
          </div>

          {/* Stats strip */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {[
              { label: "Norma", value: workspace.project.standard_name },
              { label: "Documental", value: `${summary.documentaryProgress}%` },
              { label: "Implementación", value: `${summary.implementationProgress}%` },
              { label: "Meta", value: formatDate(workspace.project.target_date) },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[18px] bg-white/80 px-4 py-3 text-center min-w-[90px]">
                <p className="text-xs uppercase tracking-[0.16em] text-ink/40">{stat.label}</p>
                <p className="mt-1 text-sm font-bold text-ink">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4">
          <ProjectTabs projectId={projectId} />
        </div>
      </section>

      {children}
    </div>
  );
}
