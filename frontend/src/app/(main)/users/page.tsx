import { FormField } from "@/components/form-field";
import { ActionForm } from "@/components/action-form";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCurrentUser, getUsersData } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";

export const metadata: Metadata = { title: "Usuarios — NORMAN AI" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, me] = await Promise.all([searchParams, getCurrentUser()]);

  if (!me?.is_staff) redirect("/");

  const flash = decodeFlash(query);
  const { users, errors } = await getUsersData();

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || errors[0]} />

      <SectionCard
        title="Nuevo usuario"
        description="Los usuarios administradores (staff) pueden gestionar toda la plataforma."
      >
        <ActionForm action={createUserAction} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <FormField label={<>
              Usuario *
            </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="username" placeholder="jperez" required /></FormField>
          </div>
          <div>
            <FormField label={<>
              Contraseña * (mín. 8 caracteres)
            </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="password" type="password" placeholder="••••••••" required minLength={8} /></FormField>
          </div>
          <div>
            <FormField label={<>
              Email
            </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="email" type="email" placeholder="jperez@empresa.com" /></FormField>
          </div>
          <div>
            <FormField label={<>
              Nombre
            </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="first_name" placeholder="Juan" /></FormField>
          </div>
          <div>
            <FormField label={<>
              Apellido
            </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="last_name" placeholder="Pérez" /></FormField>
          </div>
          <div className="flex flex-col justify-end">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <input name="is_staff" type="checkbox" className="h-4 w-4 accent-signal" />
              Administrador (staff)
            </label>
            <SubmitButton label="Crear usuario" pendingLabel="Creando..." className="w-full" />
          </div>
        </ActionForm>
      </SectionCard>

      <SectionCard
        title={`Usuarios (${users.length})`}
        description="Haz clic en Editar para cambiar datos, contraseña o estado."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/8 text-left">
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Usuario</th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Email</th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Nombre</th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Rol</th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Estado</th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Último acceso</th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {users.map((user) => (
                <tr key={user.id} className="group">
                  <td className="py-4 pr-4 font-semibold text-ink">{user.username}</td>
                  <td className="py-4 pr-4 text-ink/70">{user.email || "—"}</td>
                  <td className="py-4 pr-4 text-ink/70">
                    {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        user.is_staff
                          ? "bg-signal/10 text-signal"
                          : "bg-sand text-ink/70",
                      ].join(" ")}
                    >
                      {user.is_staff ? "Admin" : "Usuario"}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        user.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600",
                      ].join(" ")}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-xs text-ink/70">
                    {user.last_login ? formatDateTime(user.last_login) : "Nunca"}
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      {/* Edit inline form */}
                      <details className="group/edit">
                        <summary className="cursor-pointer rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand list-none">
                          Editar
                        </summary>
                        <div className="absolute z-10 mt-2 w-80 rounded-[20px] border border-black/8 bg-white p-4 shadow-[0_18px_50px_rgba(14,20,32,0.12)]">
                          <ActionForm action={updateUserAction} className="space-y-3">
                            <input type="hidden" name="user_id" value={user.id} />
                            <div>
                              <FormField label={<>Email</>} labelClassName="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-moss"><input name="email" type="email" defaultValue={user.email} /></FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <FormField label={<>Nombre</>} labelClassName="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-moss"><input name="first_name" defaultValue={user.first_name} /></FormField>
                              </div>
                              <div>
                                <FormField label={<>Apellido</>} labelClassName="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-moss"><input name="last_name" defaultValue={user.last_name} /></FormField>
                              </div>
                            </div>
                            <div>
                              <FormField label={<>Nueva contraseña (dejar en blanco para no cambiar)</>} labelClassName="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-moss"><input name="password" type="password" placeholder="••••••••" minLength={8} /></FormField>
                            </div>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                                <input
                                  name="is_staff"
                                  type="checkbox"
                                  defaultChecked={user.is_staff}
                                  className="h-3.5 w-3.5 accent-signal"
                                />
                                Admin
                              </label>
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                                <input
                                  name="is_active"
                                  type="checkbox"
                                  defaultChecked={user.is_active}
                                  className="h-3.5 w-3.5 accent-signal"
                                />
                                Activo
                              </label>
                            </div>
                            <SubmitButton label="Guardar" pendingLabel="Guardando..." className="w-full" />
                          </ActionForm>
                        </div>
                      </details>

                      {user.username !== me.username && (
                        <ActionForm action={deleteUserAction}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <DeleteButton
                            label="Desactivar"
                            confirmMessage={`¿Desactivar al usuario "${user.username}"? Su historial se conservará.`}
                          />
                        </ActionForm>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
