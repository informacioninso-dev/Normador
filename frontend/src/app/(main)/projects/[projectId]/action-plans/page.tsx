import { notFound } from "next/navigation";

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

  const workspace = await getProjectWorkspace(projectId);

  if (!workspace.project) {
    notFound();
  }

  const returnPath = `/projects/${projectId}/action-plans`;
  const openPlans = workspace.actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );
  const closedPlans = workspace.actionPlans.filter((plan) =>
    ["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Nuevo plan de accion"
        description="Registra un pendiente directamente si no fue generado automaticamente desde una revision."
        action={
          <form action={createActionPlanAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Requisito
              </label>
              <select name="requirement" defaultValue="">
                <option value="">Sin requisito especifico</option>
                {workspace.requirements.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.clause} — {req.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Titulo
              </label>
              <input name="title" placeholder="Actualizar procedimiento de almacenamiento" required />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Descripcion
              </label>
              <textarea name="description" placeholder="Detalle del pendiente..." />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Fecha objetivo
              </label>
              <input type="date" name="due_date" />
            </div>
            <SubmitButton label="Crear plan" pendingLabel="Guardando..." className="w-full" />
          </form>
        }
      >
        <div className="space-y-3">
          {openPlans.length ? (
            openPlans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-[26px] border border-black/8 bg-white/78 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {plan.clause || "Sin clausula"} · {plan.risk_level}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{plan.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/72">
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
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Evidencias</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {plan.validated_evidence_count}/{plan.evidence_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Fecha objetivo</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatDate(plan.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Seguimiento</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {plan.activity_count} registros
                    </p>
                    <p className="mt-1 text-xs text-ink/60">
                      Ultimo: {formatDate(plan.latest_activity_on)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {plan.status === "PENDIENTE" && (
                    <form action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="start_progress" />
                      <SubmitButton label="Iniciar" pendingLabel="..." />
                    </form>
                  )}
                  {plan.status === "EN_PROGRESO" && (
                    <form action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="resolve" />
                      <SubmitButton label="Resolver" pendingLabel="..." />
                    </form>
                  )}
                  {plan.status === "RESUELTO" && (
                    <form action={transitionActionPlanAction}>
                      <input type="hidden" name="return_path" value={returnPath} />
                      <input type="hidden" name="action_plan_id" value={plan.id} />
                      <input type="hidden" name="transition" value="close_plan" />
                      <SubmitButton label="Cerrar" pendingLabel="..." />
                    </form>
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
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
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
