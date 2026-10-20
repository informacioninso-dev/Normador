import Link from "next/link";

import { createCompanyAction, deleteCompanyAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { FormField } from "@/components/form-field";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { canManageCompany, companyRoleLabel } from "@/lib/access";
import { decodeFlash, getCompaniesData } from "@/lib/api";

export default async function CompaniesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const data = await getCompaniesData();
  const createView = query.view === "new";
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const archived = query.status === "archived";
  const companies = data.companies.filter((company) => company.is_active !== archived && `${company.name} ${company.ruc}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <div className="space-y-6">
    <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><h1 className="text-3xl font-bold text-ink">Empresas cliente</h1><p className="mt-2 max-w-3xl text-sm text-ink/70">Elige la empresa con la que vas a trabajar. Dentro encontrarás sus proyectos y su equipo.</p></div>
      {!createView && <Link href="/companies?view=new" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white">Crear empresa cliente</Link>}
    </header>

    {createView ? <SectionCard title="Crear empresa cliente" description="Registra la empresa una sola vez. Después podrás crear varios proyectos y dar acceso a su equipo." action={<Link href="/companies" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a empresas</Link>}>
      <ActionForm action={createCompanyAction} className="grid gap-4 md:grid-cols-2">
        <FormField label="Nombre de la empresa"><input name="name" required maxLength={255} /></FormField>
        <FormField label="RUC"><input name="ruc" required maxLength={32} /></FormField>
        <FormField label="Industria (opcional)"><input name="industry" maxLength={255} /></FormField>
        <div className="flex items-end"><SubmitButton label="Crear empresa y continuar" pendingLabel="Creando empresa..." /></div>
      </ActionForm>
    </SectionCard> : <SectionCard title={archived ? "Empresas archivadas" : "Tus empresas cliente"}>
      <form method="GET" className="mb-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <FormField label="Buscar por nombre o RUC"><input type="search" name="q" defaultValue={search} /></FormField>
        <FormField label="Estado"><select name="status" defaultValue={archived ? "archived" : "active"}><option value="active">Activas</option><option value="archived">Archivadas</option></select></FormField>
        <button type="submit" className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Buscar</button>
      </form>
      {companies.length ? <div className="divide-y divide-ink/10">{companies.map((company) => {
        const projects = data.projects.filter((project) => project.company === company.id);
        return <article key={company.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-start">
          <div className="min-w-0"><h3 className="break-words text-xl font-semibold"><Link href={`/companies/${company.id}`} className="inline-flex min-h-11 items-center text-signal underline">{company.name}</Link></h3>
            <p className="mt-1 text-sm text-ink/70">RUC {company.ruc} · {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}</p>
            <p className="mt-2 text-sm">Tu acceso: <strong>{companyRoleLabel(company.my_role)}</strong></p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link href={`/companies/${company.id}`} className="ui-pill inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold">Abrir empresa</Link>
            {canManageCompany(company) && <Link href={`/companies/${company.id}?view=team`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Equipo y accesos</Link>}
            {canManageCompany(company) && company.is_active && <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-ink/70">Opciones</summary><ActionForm action={deleteCompanyAction} className="mt-2"><input type="hidden" name="company_id" value={company.id} /><input type="hidden" name="return_path" value="/companies" /><DeleteButton label="Archivar empresa" confirmMessage={`¿Archivar "${company.name}"? Sus proyectos y documentos se conservarán.`} /></ActionForm></details>}
          </div>
        </article>;
      })}</div> : <EmptyState title={search ? "No encontramos esa empresa" : archived ? "No hay empresas archivadas" : "Todavía no tienes empresas cliente"} description={search ? "Prueba otro nombre o RUC, o cambia el estado del filtro." : archived ? "Las empresas archivadas conservarán aquí sus proyectos y documentos." : "Crea una empresa para comenzar. Si ya trabajas con una, pide a su responsable que asigne acceso a tu cuenta."} />}
    </SectionCard>}
  </div>;
}
