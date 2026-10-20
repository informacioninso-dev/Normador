import { notFound } from "next/navigation";
import Link from "next/link";

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
      <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
        <Link href="/companies" className="inline-flex min-h-11 items-center text-signal underline">Empresas cliente</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/companies/${project.company}`} className="inline-flex min-h-11 items-center break-words text-signal underline">{project.company_name}</Link>
        <span aria-hidden="true">/</span><span aria-current="page">{project.name}</span>
        <Link href={`/companies/${project.company}?view=team`} className="ml-auto inline-flex min-h-11 items-center font-semibold text-signal underline">Equipo y acceso de la empresa</Link>
      </nav>
      <section className="ui-surface rounded-[28px] px-4 pt-4 pb-0 md:px-5 md:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-2xl font-bold text-ink md:text-3xl">{project.name}</h1><p className="mt-2 text-sm text-ink/70">{project.standard_name}</p></div><StatusBadge value={project.status} /></div>
        <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm text-ink/70">Alcance y fechas del proyecto</summary><p className="max-w-3xl whitespace-pre-wrap text-sm leading-6">{project.scope || "Sin alcance adicional registrado."}</p><p className="mt-2 text-sm text-ink/70">Fecha objetivo: {formatDate(project.target_date)}</p></details>

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
