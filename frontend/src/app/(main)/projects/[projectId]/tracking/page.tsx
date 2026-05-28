import { notFound } from "next/navigation";

import { createImplementationActivityAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/presentation";

const activityLabels: Record<string, string> = {
  INICIO: "Inicio",
  AVANCE: "Avance",
  SEGUIMIENTO: "Seguimiento",
  REUNION: "Reunion",
  ENTREGABLE: "Entregable",
  BLOQUEO: "Bloqueo",
  CIERRE: "Cierre",
};

const activityTones: Record<string, string> = {
  INICIO: "bg-moss/12 text-moss",
  AVANCE: "bg-signal/12 text-signal",
  SEGUIMIENTO: "bg-ink/8 text-ink/72",
  REUNION: "bg-sand text-ink/72",
  ENTREGABLE: "bg-emerald-100 text-emerald-700",
  BLOQUEO: "bg-red-100 text-red-700",
  CIERRE: "bg-ink text-sand",
};

function isFollowUpDue(value: string | null) {
  if (!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return value <= today;
}

export default async function ProjectTrackingPage({
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

  const returnPath = `/projects/${projectId}/tracking`;
  const openPlans = workspace.actionPlans.filter(
    (plan) => !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
  );
  const actionPlanById = new Map(workspace.actionPlans.map((plan) => [plan.id, plan]));
  const blockedCount = workspace.implementationActivities.filter(
    (activity) => activity.activity_type === "BLOQUEO",
  ).length;
  const dueFollowUps = workspace.implementationActivities.filter((activity) =>
    isFollowUpDue(activity.next_follow_up_on),
  ).length;

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Registros</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {workspace.implementationActivities.length}
          </p>
        </div>
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Bloqueos</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{blockedCount}</p>
        </div>
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Seguimientos vencidos</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{dueFollowUps}</p>
        </div>
      </section>

      <SectionCard
        title="Registrar actividad"
        description="Bitacora operativa del implementador sobre planes, reuniones, avances y bloqueos."
        action={
          <form action={createImplementationActivityAction} className="space-y-3">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Plan
              </label>
              <select name="action_plan" defaultValue="">
                <option value="">Actividad general del proyecto</option>
                {workspace.actionPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Tipo
              </label>
              <select name="activity_type" defaultValue="SEGUIMIENTO">
                {Object.entries(activityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Titulo
              </label>
              <input name="title" placeholder="Llamada con responsable de almacenamiento" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Nota
              </label>
              <textarea
                name="notes"
                placeholder="Que se hizo, que falta y que quedo bloqueado."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Fecha
                </label>
                <input
                  type="date"
                  name="happened_on"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Proximo seguimiento
                </label>
                <input type="date" name="next_follow_up_on" />
              </div>
            </div>

            <SubmitButton label="Registrar" pendingLabel="Guardando..." className="w-full" />
          </form>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] bg-sand/72 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-moss">Planes abiertos</p>
            <p className="mt-2 text-xl font-semibold text-ink">{openPlans.length}</p>
          </div>
          <div className="rounded-[22px] bg-sand/72 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-moss">Con actividad</p>
            <p className="mt-2 text-xl font-semibold text-ink">
              {workspace.actionPlans.filter((plan) => plan.activity_count > 0).length}
            </p>
          </div>
          <div className="rounded-[22px] bg-sand/72 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-moss">Ultimo registro</p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {workspace.implementationActivities[0]
                ? formatDate(workspace.implementationActivities[0].happened_on)
                : "Sin actividad"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Timeline">
        {workspace.implementationActivities.length ? (
          <div className="space-y-3">
            {workspace.implementationActivities.map((activity) => {
              const plan = activity.action_plan
                ? actionPlanById.get(activity.action_plan) ?? null
                : null;

              return (
                <article
                  key={activity.id}
                  className="rounded-[24px] border border-black/8 bg-white/78 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                            activityTones[activity.activity_type] ?? "bg-sand text-ink/72",
                          ].join(" ")}
                        >
                          {activityLabels[activity.activity_type] ?? activity.activity_type}
                        </span>
                        <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
                          {formatDate(activity.happened_on)}
                        </p>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-ink">{activity.title}</h3>
                      {activity.notes ? (
                        <p className="mt-2 text-sm leading-6 text-ink/72">{activity.notes}</p>
                      ) : null}
                    </div>

                    {plan ? <StatusBadge value={plan.status} /> : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Plan</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {activity.action_plan_title || "General"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
                        Proximo seguimiento
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {formatDate(activity.next_follow_up_on)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Registro</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {activity.created_by_username || "Sistema"} ·{" "}
                        {formatDateTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Sin seguimiento"
            description="Registra avances, bloqueos o reuniones para dejar trazabilidad operativa del implementador."
          />
        )}
      </SectionCard>
    </div>
  );
}
