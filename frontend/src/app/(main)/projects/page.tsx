import { FormField } from "@/components/form-field";
import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageCompany, canPrepareCompany } from "@/lib/access";

import { createProjectAction, deleteProjectAction } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectsData } from "@/lib/api";
import {
  computeDocumentaryProgress,
  computeImplementationProgress,
  projectChecklist,
} from "@/lib/metrics";
import { formatDate } from "@/lib/presentation";
import type { ActionPlan, ChecklistItem, Company, Project, Standard } from "@/lib/types";

type ProjectsView = "empresa" | "estado" | "lista" | "nuevo";

const projectViews: Array<{ key: Exclude<ProjectsView, "nuevo">; label: string }> = [
  { key: "empresa", label: "Por empresa" },
  { key: "estado", label: "Estado" },
  { key: "lista", label: "Lista" },
];

const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];

function selectedView(value?: string | string[]): ProjectsView {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "nuevo") {
    return "nuevo";
  }
  return projectViews.some((view) => view.key === raw) ? (raw as ProjectsView) : "empresa";
}

function projectMetrics(
  project: Project,
  checklistItems: ChecklistItem[],
  actionPlans: ActionPlan[],
) {
  const checklist = projectChecklist(project, checklistItems);

  return {
    documentaryProgress: computeDocumentaryProgress(checklist),
    implementationProgress: computeImplementationProgress(checklist),
    openActionPlans: actionPlans.filter(
      (plan) =>
        plan.project === project.id && !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
    ).length,
  };
}

function ProjectCard({
  project,
  checklistItems,
  actionPlans,
  canDelete,
}: {
  project: Project;
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
  canDelete: boolean;
}) {
  const metrics = projectMetrics(project, checklistItems, actionPlans);

  return (
    <article className="rounded-[18px] border border-signal/18 bg-white p-4 shadow-[0_18px_38px_rgba(27,37,84,0.13)]">
      <div className="grid gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
            {project.standard_name}
          </p>
          <Link
            href={`/projects/${project.id}`}
            className="mt-1 block text-base font-bold leading-snug text-ink transition hover:text-signal"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {project.name}
          </Link>
        </div>
        <StatusBadge value={project.status} className="w-fit" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/70">Doc</p>
          <p className="mt-1 font-semibold text-ink">{metrics.documentaryProgress}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/70">Impl</p>
          <p className="mt-1 font-semibold text-ink">{metrics.implementationProgress}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/70">Pend</p>
          <p className="mt-1 font-semibold text-ink">{metrics.openActionPlans}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-semibold text-signal transition hover:text-signal/80"
        >
          Abrir
        </Link>
        <p className="text-xs text-ink/70">Meta {formatDate(project.target_date)}</p>
      </div>

      {canDelete ? (
        <ActionForm action={deleteProjectAction} className="mt-3">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="return_path" value="/projects" />
          <DeleteButton
            label="Archivar"
            confirmMessage={`¿Archivar "${project.name}"? Sus documentos, revisiones y planes se conservarán.`}
          />
        </ActionForm>
      ) : null}
    </article>
  );
}

function CompanyBoard({
  companies,
  projects,
  checklistItems,
  actionPlans,
}: {
  companies: Company[];
  projects: Project[];
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
}) {
  if (!companies.length && !projects.length) {
    return (
      <EmptyState
        title="Sin proyectos"
        description="Crea un proyecto para abrir el tablero de gestion."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {companies.map((company) => {
        const companyProjects = projects.filter((project) => project.company === company.id);

        return (
          <section
            key={company.id}
            className="rounded-[22px] border border-signal/14 bg-[linear-gradient(180deg,rgba(235,241,255,0.98),rgba(219,228,248,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className="truncate text-lg font-bold text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <Link href={`/companies/${company.id}`} className="text-signal underline">{company.name}</Link>
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-moss">
                  {companyProjects.length} proyectos
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {companyProjects.length ? (
                companyProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    checklistItems={checklistItems}
                    actionPlans={actionPlans}
                    canDelete={canManageCompany(company)}
                  />
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-signal/18 bg-white/86 p-4 text-sm text-ink/70">
                  Sin proyectos.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusBoard({
  projects,
  checklistItems,
  actionPlans,
  manageableCompanyIds,
}: {
  projects: Project[];
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
  manageableCompanyIds: number[];
}) {
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
      {projectStatuses.map((status) => {
        const statusProjects = projects.filter((project) => project.status === status);

        return (
          <section
            key={status}
            className="min-h-[220px] w-[min(84vw,340px)] shrink-0 rounded-[22px] border border-signal/14 bg-[linear-gradient(180deg,rgba(235,241,255,0.98),rgba(219,228,248,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] lg:w-[320px]"
          >
            <div className="flex items-center justify-between gap-3">
              <StatusBadge value={status} />
              <span className="text-sm font-semibold text-ink/70">{statusProjects.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {statusProjects.length ? (
                statusProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    checklistItems={checklistItems}
                    actionPlans={actionPlans}
                    canDelete={manageableCompanyIds.includes(project.company)}
                  />
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-signal/18 bg-white/86 p-4 text-sm text-ink/70">
                  Sin proyectos.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ProjectTable({
  projects,
  checklistItems,
  actionPlans,
}: {
  projects: Project[];
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
}) {
  if (!projects.length) {
    return (
      <EmptyState
        title="Sin proyectos"
        description="Crea un proyecto para gestionar implementacion, seguimiento y cierre."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-signal/14 bg-white shadow-[0_18px_38px_rgba(27,37,84,0.1)]">
      <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.6fr_0.6fr_0.6fr] gap-4 border-b border-signal/12 bg-[#e5ecfb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/58 md:grid">
        <span>Proyecto</span>
        <span>Empresa</span>
        <span>Estado</span>
        <span>Doc</span>
        <span>Impl</span>
        <span>Pend</span>
      </div>
      {projects.map((project) => {
        const metrics = projectMetrics(project, checklistItems, actionPlans);

        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="grid gap-3 border-b border-black/6 px-4 py-4 transition last:border-b-0 hover:bg-sand/42 md:grid-cols-[1.4fr_1fr_0.8fr_0.6fr_0.6fr_0.6fr] md:items-center"
          >
            <div>
              <p className="font-semibold text-ink">{project.name}</p>
              <p className="mt-1 text-sm text-ink/58">{project.standard_name}</p>
            </div>
            <p className="text-sm text-ink/70">{project.company_name}</p>
            <StatusBadge value={project.status} className="w-fit" />
            <p className="text-sm font-semibold text-ink">{metrics.documentaryProgress}%</p>
            <p className="text-sm font-semibold text-ink">{metrics.implementationProgress}%</p>
            <p className="text-sm font-semibold text-ink">{metrics.openActionPlans}</p>
          </Link>
        );
      })}
    </div>
  );
}

function CreateProjectForm({ companies, standards, defaultCompany }: {
  companies: Company[];
  standards: Standard[];
  defaultCompany?: string;
}) {
  const selected = companies.find((company) => String(company.id) === defaultCompany);
  return <ActionForm action={createProjectAction} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="status" value="PLANNING" />
    {selected ? <div className="md:col-span-2"><input type="hidden" name="company" value={selected.id} /><p className="text-sm">Empresa cliente: <strong>{selected.name}</strong></p><p className="mt-1 text-sm text-ink/70">El equipo y los permisos de esta empresa se aplicarán al proyecto.</p></div> : <FormField label="Empresa cliente"><select name="company" required defaultValue=""><option value="" disabled>Selecciona la empresa existente</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></FormField>}
    <FormField label="Norma"><select name="standard" required defaultValue=""><option value="" disabled>Selecciona la norma</option>{standards.filter((standard) => standard.is_active).map((standard) => <option key={standard.id} value={standard.id}>{standard.name}</option>)}</select></FormField>
    <FormField label="Nombre del proyecto"><input name="name" required maxLength={255} placeholder="Implementación ISO 13485 — Planta Norte" /></FormField>
    <div className="md:col-span-2"><FormField label="Alcance"><textarea name="scope" required placeholder="Procesos, sedes o áreas incluidas." /></FormField></div>
    <FormField label="Fecha de inicio (opcional)"><input name="start_date" type="date" /></FormField>
    <FormField label="Fecha objetivo (opcional)"><input name="target_date" type="date" /></FormField>
    <div className="md:col-span-2"><SubmitButton label="Crear proyecto y continuar" pendingLabel="Creando proyecto..." /></div>
  </ActionForm>;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const activeView = selectedView(query.view);
  const defaultCompany = Array.isArray(query.company) ? query.company[0] : query.company;
  const data = await getProjectsData();
  const company = defaultCompany ? data.companies.find((item) => String(item.id) === defaultCompany) : undefined;
  if (defaultCompany && !company && !data.errors.length) notFound();
  const companies = company ? [company] : data.companies;
  const projects = company ? data.projects.filter((project) => project.company === company.id) : data.projects;
  const writableCompanies = companies.filter((item) => item.is_active && canPrepareCompany(item));
  const companyQuery = company ? `&company=${company.id}` : "";
  const backPath = company ? `/companies/${company.id}` : "/projects";

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><h1 className="text-3xl font-bold">{company ? `Proyectos de ${company.name}` : "Todos los proyectos"}</h1><p className="mt-2 max-w-3xl text-sm text-ink/70">{company ? "El equipo y sus permisos se gestionan desde esta empresa." : "Vista general de las empresas a las que tienes acceso. Para trabajar con un cliente, abre su empresa."}</p></div>
        {activeView === "nuevo" ? <Link href={backPath} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver</Link> : <Link href={company ? `/companies/${company.id}` : "/companies"} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">{company ? "Abrir empresa" : "Elegir empresa cliente"}</Link>}
      </header>
      <SectionCard
        title={activeView === "nuevo" ? "Crear proyecto" : "Proyectos"}
        action={activeView !== "nuevo" ?
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {projectViews.map((view) => (
              <Link
                key={view.key}
                href={`/projects?view=${view.key}${companyQuery}`}
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
            {writableCompanies.length > 0 && <Link href={`/projects?view=nuevo${companyQuery}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white">Crear proyecto</Link>}
          </div> : undefined
        }
      >
        {activeView === "nuevo" ? writableCompanies.length ? <CreateProjectForm companies={writableCompanies} standards={data.standards} defaultCompany={defaultCompany} /> : <div className="space-y-3"><p className="text-sm text-ink/70">No hay una empresa activa en la que puedas crear proyectos. El responsable de la empresa puede revisar tu acceso.</p><Link href="/companies" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a empresas cliente</Link></div> : null}
        {activeView === "nuevo" && !company && <p className="mt-5 text-sm text-ink/70">¿Es un cliente nuevo? <Link href="/companies?view=new" className="font-semibold text-signal underline">Registra primero su empresa</Link> y después crea el proyecto aquí.</p>}

        {activeView === "empresa" ? (
          <CompanyBoard
            companies={companies}
            projects={projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
          />
        ) : null}

        {activeView === "estado" ? (
          <StatusBoard
            projects={projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
            manageableCompanyIds={companies.filter(canManageCompany).map((item) => item.id)}
          />
        ) : null}

        {activeView === "lista" ? (
          <ProjectTable
            projects={projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
