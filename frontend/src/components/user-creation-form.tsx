"use client";

import { useState } from "react";
import Link from "next/link";

import { createUserAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import { companyRoles } from "@/lib/access";
import type { Company } from "@/lib/types";

export function UserCreationForm({ companies, defaultCompany }: { companies: Company[]; defaultCompany?: string }) {
  const [globalAdmin, setGlobalAdmin] = useState(false);
  const [role, setRole] = useState("LECTOR");
  const activeCompanies = companies.filter((company) => company.is_active);

  return (
    <ActionForm action={createUserAction} className="space-y-6">
      <p className="max-w-3xl text-sm text-ink/70">La persona usará una sola cuenta. Asigna aquí su primer acceso; después puedes añadirla al equipo de otras empresas con un rol diferente.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Nombre de usuario"><input name="username" required maxLength={150} autoComplete="off" /></FormField>
        <FormField label="Contraseña inicial (mínimo 8 caracteres)"><input name="password" type="password" required minLength={8} autoComplete="new-password" /></FormField>
        <FormField label="Nombre"><input name="first_name" autoComplete="given-name" /></FormField>
        <FormField label="Apellido"><input name="last_name" autoComplete="family-name" /></FormField>
        <FormField label="Correo electrónico (opcional)"><input name="email" type="email" autoComplete="email" /></FormField>
      </div>

      {!globalAdmin && (
        <fieldset className="space-y-3 border-t border-ink/10 pt-5">
          <legend className="px-1 font-semibold">Primer acceso a una empresa cliente</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Empresa cliente"><select name="company" required defaultValue={activeCompanies.some((company) => String(company.id) === defaultCompany) ? defaultCompany : ""}>
              <option value="" disabled>Selecciona la empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select></FormField>
            <FormField label="Rol en esta empresa"><select name="role" value={role} onChange={(event) => setRole(event.target.value)} aria-describedby="new-user-role-help">
              {companyRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select></FormField>
          </div>
          <p id="new-user-role-help" className="text-sm text-ink/70">{companyRoles.find((item) => item.value === role)?.description} El acceso abarca todos los proyectos de esta empresa.</p>
          {!activeCompanies.length && <p className="text-sm text-ink/80">Primero <Link href="/companies?view=new" className="font-semibold text-signal underline">crea una empresa cliente</Link> para asignar el acceso.</p>}
        </fieldset>
      )}

      <details className="border-t border-ink/10 pt-4">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Administración de la plataforma</summary>
        <label className="flex min-h-11 items-center gap-3 py-2 text-sm font-semibold">
          <input type="checkbox" name="is_staff" checked={globalAdmin} onChange={(event) => setGlobalAdmin(event.target.checked)} className="h-5 w-5" aria-describedby="global-access-help" />
          Dar acceso de administrador global
        </label>
        <p id="global-access-help" className="max-w-3xl text-sm text-ink/70">Puede administrar usuarios y consultar o modificar todas las empresas cliente. Reserva este acceso para quien administra NORMAN.</p>
      </details>
      <SubmitButton label={globalAdmin ? "Crear administrador global" : "Crear cuenta y dar acceso"} pendingLabel="Creando cuenta..." disabled={!globalAdmin && !activeCompanies.length} />
    </ActionForm>
  );
}
