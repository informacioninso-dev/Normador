import Link from "next/link";

import { createProjectAction, deleteProjectAction } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCurrentUser, getProjectsData } from "@/lib/api";
import {
  computeDocumentaryProgress,
  computeImplementationProgress,
  projectChecklist,
} from "@/lib/metrics";
import { formatDate } from "@/lib/presentation";
import type { ActionPlan, ChecklistItem, Company, Project, Standard } from "@/lib/types";

type ProjectsView = "empresa" | "estado" | "lista" | "nuevo";

const projectViews: Array<{ key: Exclude<ProjectsView, "nuevo">; label: string }> = [
  { key: "empresa", label: "Empresas" },
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
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/45">Doc</p>
          <p className="mt-1 font-semibold text-ink">{metrics.documentaryProgress}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/45">Impl</p>
          <p className="mt-1 font-semibold text-ink">{metrics.implementationProgress}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink/45">Pend</p>
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
        <p className="text-xs text-ink/48">Meta {formatDate(project.target_date)}</p>
      </div>

      {canDelete ? (
        <form action={deleteProjectAction} className="mt-3">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="return_path" value="/projects" />
          <DeleteButton
            label="Eliminar"
            confirmMessage={`Eliminar "${project.name}"? Se borraran sus documentos, revisiones y planes. Esta accion no se puede deshacer.`}
          />
        </form>
      ) : null}
    </article>
  );
}

function CompanyBoard({
  companies,
  projects,
  checklistItems,
  actionPlans,
  canDelete,
}: {
  companies: Company[];
  projects: Project[];
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
  canDelete: boolean;
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
                  {company.name}
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
                    canDelete={canDelete}
                  />
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-signal/18 bg-white/86 p-4 text-sm text-ink/60">
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
  canDelete,
}: {
  projects: Project[];
  checklistItems: ChecklistItem[];
  actionPlans: ActionPlan[];
  canDelete: boolean;
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
              <span className="text-sm font-semibold text-ink/60">{statusProjects.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {statusProjects.length ? (
                statusProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    checklistItems={checklistItems}
                    actionPlans={actionPlans}
                    canDelete={canDelete}
                  />
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-signal/18 bg-white/86 p-4 text-sm text-ink/60">
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
            <p className="text-sm text-ink/72">{project.company_name}</p>
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

function CreateProjectForm({
  companies,
  standards,
  defaultCompany,
}: {
  companies: Company[];
  standards: Standard[];
  defaultCompany?: string;
}) {
  return (
    <form action={createProjectAction} className="grid gap-4 lg:grid-cols-2">
      <input type="hidden" name="return_path" value="/projects?view=nuevo" />
      <input type="hidden" name="success_return_path" value="/projects" />
      <input type="hidden" name="status" value="PLANNING" />

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Empresa existente
        </label>
        <select name="company" defaultValue={defaultCompany ?? ""}>
          <option value="">
            {companies.length ? "Selecciona una empresa" : "No hay empresas cargadas"}
          </option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Norma
        </label>
        <select name="standard" required defaultValue="">
          <option value="" disabled>
            Selecciona una norma
          </option>
          {standards.map((standard) => (
            <option key={standard.id} value={standard.id}>
              {standard.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Empresa nueva
        </label>
        <input name="company_name" placeholder="Laboratorio Andino" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          RUC
        </label>
        <input name="company_ruc" placeholder="0999999999001" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Industria
        </label>
        <input name="company_industry" placeholder="Opcional" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Nombre
        </label>
        <input name="name" placeholder="Implementacion ISO 13485 - Planta Norte" required />
      </div>

      <div className="lg:col-span-2">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Alcance
        </label>
        <textarea name="scope" placeholder="Procesos, sedes o areas incluidas." required />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Inicio
        </label>
        <input type="date" name="start_date" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          Meta
        </label>
        <input type="date" name="target_date" />
      </div>

      <div className="lg:col-span-2">
        <SubmitButton label="Crear proyecto" pendingLabel="Creando..." className="w-full" />
      </div>
    </form>
  );
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
  const [data, user] = await Promise.all([getProjectsData(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <SectionCard
        title="Proyectos"
        action={
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {projectViews.map((view) => (
              <Link
                key={view.key}
                href={`/projects?view=${view.key}`}
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
        {activeView === "nuevo" ? (
          <CreateProjectForm
            companies={data.companies}
            standards={data.standards}
            defaultCompany={defaultCompany}
          />
        ) : null}

        {activeView === "empresa" ? (
          <CompanyBoard
            companies={data.companies}
            projects={data.projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
            canDelete={Boolean(user?.is_staff)}
          />
        ) : null}

        {activeView === "estado" ? (
          <StatusBoard
            projects={data.projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
            canDelete={Boolean(user?.is_staff)}
          />
        ) : null}

        {activeView === "lista" ? (
          <ProjectTable
            projects={data.projects}
            checklistItems={data.checklistItems}
            actionPlans={data.actionPlans}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
