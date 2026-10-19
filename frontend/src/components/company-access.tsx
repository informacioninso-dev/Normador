import { ActionForm } from "@/components/action-form";
import { saveMembershipAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import type { Company, CompanyMembership } from "@/lib/types";

const roles = [
  ["RESPONSABLE", "Responsable"], ["IMPLEMENTADOR", "Implementador"],
  ["AUDITOR", "Auditor"], ["LECTOR", "Lector"],
];

export function CompanyAccess({ companies, memberships }: { companies: Company[]; memberships: CompanyMembership[] }) {
  const managed = companies.filter((company) => ["ADMINISTRADOR", "RESPONSABLE"].includes(company.my_role));
  if (!managed.length) return null;
  return (
    <SectionCard title="Acceso por empresa" description="Asigna acceso a una cuenta existente. El responsable gestiona el equipo; el implementador prepara documentos y acciones; el auditor valida; el lector consulta.">
      <ActionForm action={saveMembershipAction} className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="access-company" className="mb-2 block text-sm font-semibold">Empresa</label>
          <select id="access-company" name="company" required>{managed.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        </div>
        <div>
          <label htmlFor="access-username" className="mb-2 block text-sm font-semibold">Nombre de usuario</label>
          <input id="access-username" name="username" required maxLength={150} autoComplete="off" aria-describedby="access-help" />
        </div>
        <div>
          <label htmlFor="access-role" className="mb-2 block text-sm font-semibold">Rol</label>
          <select id="access-role" name="role" defaultValue="LECTOR">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <SubmitButton label="Dar acceso" pendingLabel="Guardando..." />
      </ActionForm>
      <p id="access-help" className="mt-3 text-sm text-ink/80">Un administrador crea la cuenta en Usuarios. Dar acceso aquí no envía invitaciones.</p>
      {memberships.length ? (
        <div className="mt-6 divide-y divide-black/10">
          {memberships.map((membership) => (
            <ActionForm key={membership.id} action={saveMembershipAction} className="grid items-center gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input type="hidden" name="membership_id" value={membership.id} />
              <input type="hidden" name="company" value={membership.company} />
              <input type="hidden" name="username" value={membership.username} />
              <div className="min-w-0 break-words"><strong>{membership.username}</strong><p className="text-sm text-ink/80">{membership.company_name}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor={`role-${membership.id}`} className="mb-1 block text-sm">Rol</label><select id={`role-${membership.id}`} name="role" defaultValue={membership.role}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label htmlFor={`active-${membership.id}`} className="mb-1 block text-sm">Acceso</label><select id={`active-${membership.id}`} name="is_active" defaultValue={String(membership.is_active)}><option value="true">Activo</option><option value="false">Desactivado</option></select></div>
              </div>
              <SubmitButton label="Guardar acceso" pendingLabel="Guardando..." />
            </ActionForm>
          ))}
        </div>
      ) : <p className="mt-5 text-sm">Aún no hay accesos adicionales. Asigna una cuenta y su rol.</p>}
    </SectionCard>
  );
}
