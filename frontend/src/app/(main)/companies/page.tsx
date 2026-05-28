import Link from "next/link";

import { createCompanyAction, deleteCompanyAction } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCompaniesData, getCurrentUser } from "@/lib/api";
import { formatDate, pluralize } from "@/lib/presentation";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const [data, user] = await Promise.all([getCompaniesData(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <SectionCard
        title="Empresas"
        description="Registro administrativo. Tambien puedes crear una empresa al dar de alta un proyecto."
      >
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form action={createCompanyAction} className="space-y-3">
            <input type="hidden" name="return_path" value="/companies" />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Nombre
              </label>
              <input name="name" placeholder="Laboratorio Andino" required />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                RUC
              </label>
              <input name="ruc" placeholder="0999999999001" required />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Industria
              </label>
              <input name="industry" placeholder="Opcional" />
            </div>
            <SubmitButton label="Guardar empresa" pendingLabel="Guardando..." className="w-full" />
          </form>

          <div className="rounded-[24px] border border-black/8 bg-sand/72 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Flujo principal
            </p>
            <h3
              className="mt-2 text-2xl font-bold text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Proyectos
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink/72">
              Si lo que quieres es operar, entra a proyectos. Desde ahi ya puedes crear la
              empresa y abrir el checklist.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand transition hover:bg-ink/92"
            >
              Ir a proyectos
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Registro actual" description="Base de empresas del workspace.">
        {data.companies.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.companies.map((company) => {
              const companyProjects = data.projects.filter((project) => project.company === company.id);

              return (
                <article
                  key={company.id}
                  className="rounded-[24px] border border-black/8 bg-sand/75 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                    {company.industry || "Sin industria"}
                  </p>
                  <h3
                    className="mt-2 text-2xl font-bold text-ink"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {company.name}
                  </h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">RUC</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{company.ruc}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                        Proyectos
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {pluralize(companyProjects.length, "proyecto", "proyectos")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Alta</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {formatDate(company.created_at)}
                      </p>
                    </div>
                  </div>

                  {user?.is_staff && (
                    <form action={deleteCompanyAction} className="mt-4">
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="hidden" name="return_path" value="/companies" />
                      <DeleteButton
                        label="Eliminar empresa"
                        confirmMessage={`Eliminar "${company.name}"? Esta accion borrara sus proyectos y no se puede deshacer.`}
                      />
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No hay empresas registradas"
            description="Puedes crear una aqui o dejar que nazcan desde el flujo de proyectos."
          />
        )}
      </SectionCard>
    </div>
  );
}
