import Link from "next/link";

import { saveMembershipAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { canManageCompany, companyRoleLabel, companyRoles } from "@/lib/access";
import type { AppUser, Company, CompanyMembership } from "@/lib/types";

export function CompanyAccess({ company, memberships, users = [] }: { company: Company; memberships: CompanyMembership[]; users?: AppUser[] }) {
  if (!canManageCompany(company)) return null;
  const returnPath = `/companies/${company.id}?view=team`;
  const availableUsers = users.filter((user) => user.is_active && !user.is_staff && !memberships.some((member) => member.username === user.username));
  const staff = company.my_role === "ADMINISTRADOR";

  return <SectionCard title={`Equipo de ${company.name}`} description="El rol se aplica a todos los proyectos de esta empresa. La misma cuenta puede tener otro rol en otra empresa cliente.">
    <p className="max-w-3xl text-sm text-ink/70">Los administradores globales ya pueden acceder a todas las empresas; no necesitan un acceso adicional. Desactivar un acceso aquí afecta solo a esta empresa.</p>
    <details className="my-4 border-b border-ink/10 pb-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Qué permite cada rol</summary><ul className="space-y-2 text-sm text-ink/80">{companyRoles.map((role) => <li key={role.value}><strong>{role.label}:</strong> {role.description}</li>)}</ul></details>

    <div className="divide-y divide-ink/10">{memberships.map((member) => <article key={member.id} className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-semibold">{member.username}</h3><p className="text-sm text-ink/70">{member.user_is_staff ? "Administrador global" : companyRoleLabel(member.role)} · {!member.user_is_active ? "Cuenta desactivada" : member.is_active ? "Acceso activo" : "Acceso desactivado"}</p></div>
      {member.is_owner || member.user_is_staff ? <p className="mt-2 text-sm text-ink/70">{member.user_is_staff ? "Su cuenta tiene acceso global a NORMAN. Se administra desde Usuarios y accesos." : "Es propietario de la empresa y conserva el rol Responsable."}</p> : <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center py-2 text-sm font-semibold text-signal">Cambiar acceso de {member.username}</summary>
        <ActionForm action={saveMembershipAction} className="mt-3 grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="membership_id" value={member.id} /><input type="hidden" name="return_path" value={returnPath} />
          <FormField label="Rol en esta empresa"><select name="role" defaultValue={member.role}>{companyRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></FormField>
          <FormField label="Acceso a esta empresa"><select name="is_active" defaultValue={String(member.is_active)}><option value="true">Activo</option><option value="false">Desactivado</option></select></FormField>
          <SubmitButton label="Guardar acceso" pendingLabel="Guardando..." />
        </ActionForm>
        {!member.user_is_active && <p className="mt-2 text-sm text-ink/70">La cuenta está desactivada en toda la plataforma. Cambiar este acceso no reactiva la cuenta.</p>}
      </details>}
    </article>)}</div>
    {!memberships.length && <p className="py-4 text-sm text-ink/70">No hay miembros asignados. Los administradores globales conservan su acceso.</p>}

    <details className="mt-5 border-t border-ink/10 pt-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Añadir una cuenta existente al equipo</summary>
      {staff && !availableUsers.length ? <p className="mt-3 text-sm text-ink/70">Todas las cuentas ordinarias activas ya están asignadas. Puedes reactivar un acceso existente o crear otra cuenta.</p> : <ActionForm action={saveMembershipAction} className="mt-3 grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="company" value={company.id} /><input type="hidden" name="return_path" value={returnPath} />
        <FormField label={staff ? "Cuenta" : "Nombre de usuario existente"}>{staff ? <select name="username" required defaultValue=""><option value="" disabled>Selecciona una persona</option>{availableUsers.map((user) => <option key={user.id} value={user.username}>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username} ({user.username})</option>)}</select> : <input name="username" required maxLength={150} autoComplete="off" />}</FormField>
        <FormField label="Rol en esta empresa"><select name="role" defaultValue="LECTOR">{companyRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></FormField>
        <SubmitButton label="Dar acceso a esta empresa" pendingLabel="Guardando..." />
      </ActionForm>}
      <p className="mt-3 text-sm text-ink/70">Esta operación no crea una cuenta ni envía invitaciones. Si ya pertenece al equipo, cambia su acceso en la lista anterior.</p>
    </details>
    {staff ? <Link href={`/users?view=new&company=${company.id}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Crear cuenta y dar acceso a esta empresa</Link> : <p className="mt-4 text-sm text-ink/70">Si la persona todavía no tiene cuenta, un administrador global debe crearla.</p>}
  </SectionCard>;
}
