import { notFound } from "next/navigation";

import { ProjectTabs } from "@/components/project-tabs";
import { StatusBadge } from "@/components/status-badge";
import { getProjectHeader } from "@/lib/api";

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

  const { project, summary, error } = await getProjectHeader(projectId);

  if (!project) {
    notFound();
  }



  return (
    <div className="space-y-5">
      <section className="ui-surface rounded-[28px] px-4 pt-4 pb-0 md:px-5 md:pt-5">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
                {project.company_name}
              </span>
              <StatusBadge value={project.status} />
            </div>
            <h1
              className="mt-1.5 text-3xl font-bold leading-tight text-ink md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {project.name}
            </h1>
            {project.scope && (
              <p className="mt-1 text-sm leading-6 text-ink/70 line-clamp-2">
                {project.scope}
              </p>
            )}
          </div>

          {/* Stats strip */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {[
              { label: "Norma", value: project.standard_name },
              { label: "Documental", value: summary ? `${summary.documentary_progress_percentage}%` : "—" },
              { label: "Implementación", value: summary ? `${summary.implementation_progress_percentage}%` : "—" },
              { label: "Meta", value: formatDate(project.target_date) },
            ].map((stat) => (
              <div key={stat.label} className="ui-muted min-w-[90px] rounded-[18px] px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-ink/70">{stat.label}</p>
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

      {!project?.can_edit && <p className="text-sm text-ink/80">{project?.can_validate ? "Acceso de auditor: consulta y validación. La preparación de documentos corresponde al implementador." : "Acceso de consulta: puedes revisar y descargar la información del proyecto."}</p>}
      {summary?.has_simulated_reviews && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Este proyecto contiene revisiones simuladas de desarrollo. Sus resultados sirven para probar el flujo y no acreditan cumplimiento normativo.</p>}

      {error && <p role="alert">No se pudo cargar el resumen de avance. {error}</p>}{children}
    </div>
  );
}
