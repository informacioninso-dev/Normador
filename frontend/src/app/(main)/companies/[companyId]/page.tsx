import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyBranding } from "@/components/company-branding";
import { CompanyAccess } from "@/components/company-access";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { canManageCompany, canPrepareCompany, companyRoleLabel } from "@/lib/access";
import { decodeFlash, getCompanyData } from "@/lib/api";

export default async function CompanyPage({ params, searchParams }: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ companyId: rawId }, query] = await Promise.all([params, searchParams]);
  const companyId = Number(rawId);
  if (!Number.isSafeInteger(companyId) || companyId < 1) notFound();
  const data = await getCompanyData(companyId);
  const company = data.company;
  if (!company) notFound();
  const flash = decodeFlash(query);
  const canManage = canManageCompany(company);
  const brandingView = query.view === "branding";
  const teamView = query.view === "team";
  const basePath = `/companies/${company.id}`;
  const canCreateProject = company.is_active && canPrepareCompany(company);

  return <div className="space-y-6">
    <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />
    <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
      <Link href="/companies" className="inline-flex min-h-11 items-center text-signal underline">Empresas cliente</Link>
      <span aria-hidden="true">/</span><span aria-current="page">{company.name}</span>
    </nav>
    <header className="ui-surface rounded-[24px] p-5">
      <h1 className="break-words text-3xl font-bold text-ink">{company.name}</h1>
      <p className="mt-2 text-sm text-ink/70">RUC {company.ruc}{company.industry ? ` · ${company.industry}` : ""} · {company.is_active ? "Empresa activa" : "Empresa archivada"}</p>
      <p className="mt-2 text-sm">Tu acceso: <strong>{companyRoleLabel(company.my_role)}</strong>. {company.my_role === "ADMINISTRADOR" ? "Puedes administrar todas las empresas cliente." : "Tu rol se aplica a todos los proyectos de esta empresa."}</p>
      <nav aria-label="Secciones de la empresa" className="mt-5 flex flex-wrap gap-2">
        {[{ label: "Proyectos", href: basePath, active: !teamView && !brandingView }, { label: "Equipo y accesos", href: `${basePath}?view=team`, active: teamView }, { label: "Logo y encabezado", href: `${basePath}?view=branding`, active: brandingView }].map((item) =>
          <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${item.active ? "ui-pill-active" : "ui-pill text-ink/70 hover:bg-sand"}`}>{item.label}</Link>
        )}
      </nav>
    </header>

    {brandingView ? <CompanyBranding key={company.updated_at} company={company} canManage={canManage} /> : !teamView ? <SectionCard title="Proyectos de esta empresa" description="Cada proyecto tiene su norma, checklist, documentos y seguimiento." action={canCreateProject ?
      <Link href={`/projects?view=nuevo&company=${company.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white">Crear proyecto aquí</Link> : undefined}>
      {data.projects.length ? <div className="divide-y divide-ink/10">{data.projects.map((project) => <article key={project.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 sm:flex-row sm:items-center">
        <div className="min-w-0"><Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center break-words font-semibold text-signal underline">{project.name}</Link><p className="text-sm text-ink/70">{project.standard_name} · {project.checklist_items_count} requisitos</p></div>
        <StatusBadge value={project.status} className="w-fit" />
      </article>)}</div> : <EmptyState title="Esta empresa todavía no tiene proyectos" description={canCreateProject ? "Crea su primer proyecto seleccionando una norma y definiendo el alcance." : "Un responsable o implementador de la empresa puede crear el primer proyecto."} />}
    </SectionCard> : canManage ? <CompanyAccess company={company} memberships={data.memberships} users={data.users} /> :
      <SectionCard title="Tu acceso a esta empresa" description="El responsable de la empresa administra el equipo.">
        <p className="text-sm">Tienes el rol <strong>{companyRoleLabel(company.my_role)}</strong> en todos sus proyectos. Para cambiar tus permisos o añadir otra persona, contacta al responsable de esta empresa.</p>
      </SectionCard>}
  </div>;
}
