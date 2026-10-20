import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { deleteUserAction, updateUserAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { FlashBanner } from "@/components/flash-banner";
import { FormField } from "@/components/form-field";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { UserCreationForm } from "@/components/user-creation-form";
import { companyRoleLabel } from "@/lib/access";
import { decodeFlash, getCurrentUser, getUsersData } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";

export const metadata: Metadata = { title: "Usuarios y accesos — NORMAN AI" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, me] = await Promise.all([searchParams, getCurrentUser()]);
  if (!me?.is_staff) redirect("/");
  const flash = decodeFlash(query);
  const { users, companies, memberships, errors } = await getUsersData();
  const createView = query.view === "new";
  const selected = users.find((user) => String(user.id) === query.user);
  const companyId = typeof query.company === "string" ? query.company : undefined;
  const search = typeof query.q === "string" ? query.q.trim().toLocaleLowerCase() : "";
  const filteredUsers = users.filter((user) => `${user.username} ${user.first_name} ${user.last_name} ${user.email}`.toLocaleLowerCase().includes(search));

  return <div className="space-y-6">
    <FlashBanner success={flash.success} error={flash.error || errors[0]} />
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-bold">Usuarios y accesos</h1><p className="mt-2 max-w-3xl text-sm text-ink/70">La cuenta permite iniciar sesión. El acceso por empresa define dónde trabaja la persona y qué puede hacer.</p></div>{!createView && <Link href="/users?view=new" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white">Crear cuenta</Link>}</header>

    {createView ? <SectionCard title="Crear cuenta y configurar acceso" action={<Link href={companyId ? `/companies/${encodeURIComponent(companyId)}?view=team` : "/users"} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver</Link>}><UserCreationForm companies={companies} defaultCompany={companyId} /></SectionCard> : selected ? <>
      <SectionCard title={`Cuenta de ${selected.username}`} description="Los cambios de esta cuenta se aplican en toda la plataforma, no solo en una empresa." action={<Link href="/users" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a usuarios</Link>}>
        <ActionForm action={updateUserAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="user_id" value={selected.id} />
          <FormField label="Correo electrónico"><input name="email" type="email" defaultValue={selected.email} /></FormField>
          <FormField label="Nombre"><input name="first_name" defaultValue={selected.first_name} /></FormField>
          <FormField label="Apellido"><input name="last_name" defaultValue={selected.last_name} /></FormField>
          <FormField label="Nueva contraseña (opcional)"><input name="password" type="password" minLength={8} autoComplete="new-password" aria-describedby="password-change-help" /></FormField>
          <p id="password-change-help" className="text-sm text-ink/70 md:col-span-2">Deja la contraseña en blanco para conservarla.</p>
          {selected.username === me.username && <><input type="hidden" name="is_staff" value="on" /><input type="hidden" name="is_active" value="on" /></>}
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={selected.is_active} disabled={selected.username === me.username} className="h-5 w-5" />Cuenta activa en NORMAN</label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="is_staff" defaultChecked={selected.is_staff} disabled={selected.username === me.username} className="h-5 w-5" aria-describedby="edit-global-help" />Administrador global</label>
          <p id="edit-global-help" className="text-sm text-ink/70 md:col-span-2">El administrador global puede gestionar usuarios y todas las empresas, sin asignaciones adicionales. Para un responsable de cliente, usa el rol Responsable dentro de su empresa.</p>
          <div className="md:col-span-2"><SubmitButton label="Guardar cuenta" pendingLabel="Guardando..." /></div>
        </ActionForm>
        {selected.username !== me.username && selected.is_active && <ActionForm action={deleteUserAction} className="mt-6 border-t border-ink/10 pt-4"><input type="hidden" name="user_id" value={selected.id} /><p className="mb-3 text-sm text-ink/70">Desactivar la cuenta bloquea el inicio de sesión y el acceso a todas sus empresas. Su historial se conserva.</p><DeleteButton label="Desactivar cuenta en toda la plataforma" confirmMessage={`¿Desactivar la cuenta de ${selected.username} en todas sus empresas? Su historial se conservará.`} /></ActionForm>}
      </SectionCard>
      <SectionCard title="Acceso a empresas cliente" description={selected.is_staff ? "Esta cuenta tiene acceso global a todas las empresas." : "Gestiona cada rol desde el equipo de la empresa correspondiente."}>
        {selected.is_staff ? <Link href="/companies" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Ver todas las empresas cliente</Link> : <>
          <ul className="space-y-3">{memberships.filter((member) => member.username === selected.username).map((member) => <li key={member.id}><Link href={`/companies/${member.company}?view=team`} className="inline-flex min-h-11 items-center text-signal underline">{member.company_name}</Link><p className="text-sm text-ink/70">{companyRoleLabel(member.role)} · {member.is_active ? "Acceso asignado" : "Acceso desactivado"}{!selected.is_active ? " · Cuenta desactivada" : ""}</p></li>)}</ul>
          {!memberships.some((member) => member.username === selected.username) && <p className="text-sm text-ink/70">Esta cuenta no tiene empresas asignadas. Abre una empresa y añádela a su equipo.</p>}
          <Link href="/companies" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Elegir empresa para gestionar el acceso</Link>
        </>}
      </SectionCard>
    </> : <SectionCard title={`Cuentas (${users.length})`} description="Una persona puede trabajar en varias empresas con la misma cuenta. Desactivar un acceso por empresa no desactiva su cuenta.">
      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><FormField label="Buscar persona"><input type="search" name="q" defaultValue={typeof query.q === "string" ? query.q : ""} /></FormField></div><button type="submit" className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Buscar</button></form>
      <div className="divide-y divide-ink/10">{filteredUsers.map((user) => {
        const accesses = memberships.filter((member) => member.username === user.username && member.is_active);
        return <article key={user.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0"><h3 className="break-words font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</h3><p className="break-words text-sm text-ink/70">{user.username}{user.email ? ` · ${user.email}` : ""}</p><p className="mt-2 text-sm text-ink/70">{user.is_active ? "Cuenta activa" : "Cuenta desactivada"} · {user.last_login ? `Último acceso: ${formatDateTime(user.last_login)}` : "Sin accesos registrados"}</p></div>
          <div><p className="text-sm font-semibold">{user.is_staff ? "Administrador global · Todas las empresas" : "Acceso por empresa"}</p>{!user.is_staff && (accesses.length ? <ul className="mt-2 space-y-1">{accesses.map((member) => <li key={member.id} className="text-sm"><Link href={`/companies/${member.company}?view=team`} className="text-signal underline">{member.company_name}</Link> · {companyRoleLabel(member.role)}</li>)}</ul> : <p className="mt-2 text-sm text-ink/70">Sin acceso activo a empresas</p>)}</div>
          <Link href={`/users?user=${user.id}`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-signal underline">Ver cuenta y accesos</Link>
        </article>;
      })}</div>
      {!filteredUsers.length && <p className="py-4 text-sm text-ink/70">No hay personas que coincidan con la búsqueda.</p>}
    </SectionCard>}
  </div>;
}
