import { FormField } from "@/components/form-field";
import { RoleForm } from "@/components/role-form";
import { notFound } from "next/navigation";
import Link from "next/link";

import { createActionPlanAction, transitionActionPlanAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDate } from "@/lib/presentation";

export default async function ProjectActionPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const flash = decodeFlash(query);
  const projectId = Number(routeParams.projectId);

  if (!Number.isFinite(projectId)) {
    notFound();
  }

  const workspace = await getProjectWorkspace(projectId, ["actionPlans","requirements","checklistItems"]);

  if (!workspace.project) {
    notFound();
  }

  const requirementId = typeof query.requirement === "string" ? query.requirement : "";
  const returnPath = `/projects/${projectId}/action-plans${requirementId ? `?requirement=${encodeURIComponent(requirementId)}` : ""}`;
  const visiblePlans = workspace.actionPlans.filter((plan) => !requirementId || String(plan.requirement) === requirementId);
  const selectedItem = workspace.checklistItems.find((item) => String(item.requirement) === requirementId);
  const openPlans = visiblePlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );
  const closedPlans = visiblePlans.filter((plan) =>
    ["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Acciones correctivas y pendientes"
        description="Registra un pendiente directamente si no fue generado automaticamente desde una revision."
        action={workspace.project.can_edit ? <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Registrar una acción adicional</summary>
          <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={createActionPlanAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />
            <div>
              <FormField label={<>
                Requisito
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><select name="requirement" defaultValue={requirementId}>
                <option value="">Sin requisito especifico</option>
                {workspace.requirements.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.clause} — {req.title}
                  </option>
                ))}
              </select></FormField>
            </div>
            <div>
              <FormField label={<>
                Titulo
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input name="title" placeholder="Actualizar procedimiento de almacenamiento" required /></FormField>
            </div>
            <div>
              <FormField label={<>
                Descripcion
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><textarea name="description" placeholder="Detalle del pendiente..." /></FormField>
            </div>
            <div>
              <FormField label={<>
                Fecha objetivo
              </>} labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss"><input type="date" name="due_date" /></FormField>
            </div>
            <SubmitButton label="Crear plan" pendingLabel="Guardando..." className="w-full" />
          </RoleForm></details> : undefined
        }
      >
        <div className="space-y-3">
          {selectedItem && <Link href={`/projects/${projectId}/checklist?item=${selectedItem.id}&step=review`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a la ficha de {selectedItem.clause} · {selectedItem.title}</Link>}
          {requirementId && <Link href={`/projects/${projectId}/action-plans`} className="ml-3 inline-flex min-h-11 items-center text-sm text-signal underline">Ver todas las acciones del proyecto</Link>}
          {openPlans.length ? (
            openPlans.map((plan) => (
              <article
                key={plan.id}
                id={`plan-${plan.id}`}
                className="rounded-[26px] border border-black/8 bg-white/78 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {plan.clause || "Sin clausula"} · {plan.risk_level}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{plan.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/70">
                      {plan.recommended_action || plan.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={plan.status} />
                    {plan.is_auto_generated && (
                      <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-moss">
                        Auto
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Evidencias</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {plan.validated_evidence_count}/{plan.evidence_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Fecha objetivo</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatDate(plan.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Seguimiento</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {plan.activity_count} registros
                    </p>
                    <p className="mt-1 text-xs text-ink/70">
                      Ultimo: {formatDate(plan.latest_activity_on)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {plan.status === "PENDIENTE" && workspace.project?.can_edit && (
                    <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="start_progress" />
                      <SubmitButton label="Iniciar" pendingLabel="..." />
                    </RoleForm>
                  )}
                  {plan.status === "EN_PROGRESO" && workspace.project?.can_edit && (
                    <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="resolve" />
                      <SubmitButton label="Registrar acción realizada" pendingLabel="..." />
                    </RoleForm>
                  )}
                  {plan.status === "RESUELTO" && workspace.project?.can_validate && (
                    <RoleForm allowed={Boolean(workspace.project?.can_validate)} action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="close_plan" />
                      <SubmitButton label="Validar cierre de la acción" pendingLabel="..." />
                    </RoleForm>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="Sin pendientes abiertos"
              description="Los planes se generan automaticamente desde revisiones o puedes crear uno manual."
            />
          )}
        </div>
      </SectionCard>

      {closedPlans.length > 0 && (
        <SectionCard title="Cerrados" description="Planes resueltos o supersedidos.">
          <div className="space-y-3">
            {closedPlans.map((plan) => (
              <div key={plan.id} className="rounded-[22px] bg-sand/75 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{plan.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/70">
                      {plan.clause || "Sin clausula"}
                    </p>
                  </div>
                  <StatusBadge value={plan.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
