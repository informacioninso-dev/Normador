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

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const [data, user] = await Promise.all([getProjectsData(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <SectionCard title="Nuevo proyecto" description="Paso 2 del flujo.">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form action={createProjectAction} className="space-y-3">
            <input type="hidden" name="return_path" value="/projects" />
            <input type="hidden" name="status" value="PLANNING" />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Empresa
              </label>
              <select name="company" required defaultValue="">
                <option value="" disabled>
                  Selecciona una empresa
                </option>
                {data.companies.map((company) => (
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
                {data.standards.map((standard) => (
                  <option key={standard.id} value={standard.id}>
                    {standard.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Nombre
              </label>
              <input name="name" placeholder="Implementacion ISO 13485 - Planta Norte" required />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Alcance
              </label>
              <textarea
                name="scope"
                placeholder="Procesos, sedes o areas incluidas."
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
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
            </div>
            <SubmitButton label="Crear proyecto" pendingLabel="Creando..." className="w-full" />
          </form>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-black/8 bg-sand/74 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Al crear
              </p>
              <h3
                className="mt-2 text-2xl font-bold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Checklist automatico
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink/72">
                El backend genera los items desde los requisitos de la norma seleccionada.
              </p>
            </div>

            <div className="rounded-[24px] border border-black/8 bg-white/82 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Siguiente
              </p>
              <h3
                className="mt-2 text-2xl font-bold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Cargar documentos
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink/72">
                Despues de crear el proyecto, entra al detalle y sube el soporte inicial.
              </p>
              <Link
                href={data.projects[0] ? `/projects/${data.projects[0].id}/documents` : "/projects"}
                className="mt-4 inline-flex rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Ver ejemplo
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Proyectos" description="Selecciona uno para continuar.">
        {data.projects.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.projects.map((project) => {
              const checklist = projectChecklist(project, data.checklistItems);
              const documentaryProgress = computeDocumentaryProgress(checklist);
              const implementationProgress = computeImplementationProgress(checklist);
              const openActionPlans = data.actionPlans.filter(
                (plan) => plan.project === project.id && !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
              ).length;

              return (
                <article
                  key={project.id}
                  className="rounded-[24px] border border-black/8 bg-white/80 p-5 shadow-[0_14px_34px_rgba(14,20,32,0.06)]"
                >
                  <Link href={`/projects/${project.id}`} className="block transition hover:opacity-80">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                          {project.company_name}
                        </p>
                        <h3
                          className="mt-2 text-2xl font-bold text-ink"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {project.name}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-ink/70">{project.scope}</p>
                      </div>
                      <StatusBadge value={project.status} />
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Norma</p>
                        <p className="mt-1 text-sm font-semibold text-ink">
                          {project.standard_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                          Documental
                        </p>
                        <p className="mt-1 text-sm font-semibold text-ink">
                          {documentaryProgress}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                          Implementacion
                        </p>
                        <p className="mt-1 text-sm font-semibold text-ink">
                          {implementationProgress}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                          Pendientes
                        </p>
                        <p className="mt-1 text-sm font-semibold text-ink">{openActionPlans}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-ink/45">
                      <span>{project.checklist_items_count} requisitos</span>
                      <span>Inicio {formatDate(project.start_date)}</span>
                      <span>Meta {formatDate(project.target_date)}</span>
                    </div>
                  </Link>

                  {user?.is_staff && (
                    <form action={deleteProjectAction} className="mt-4">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_path" value="/projects" />
                      <DeleteButton
                        label="Eliminar proyecto"
                        confirmMessage={`¿Eliminar "${project.name}"? Se borrarán todos sus documentos, revisiones y planes. Esta acción no se puede deshacer.`}
                      />
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No hay proyectos"
            description="Crea el primero para abrir checklist, documentos, revisiones y cierre."
          />
        )}
      </SectionCard>
    </div>
  );
}
