import { notFound } from "next/navigation";

import { createWorklogAction, reviewWorklogAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCurrentUser, getProjectWorkspace } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/presentation";

const activityOptions = [
  ["IMPLEMENTACION", "Implementacion"],
  ["REVISION", "Revision"],
  ["REUNION", "Reunion"],
  ["SEGUIMIENTO", "Seguimiento"],
  ["CAPACITACION", "Capacitacion"],
  ["INFORME", "Informe"],
  ["ADMINISTRATIVO", "Administrativo"],
  ["OTRO", "Otro"],
];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function ProjectDailyLogPage({
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
  const currentUser = await getCurrentUser();

  if (!workspace.project) {
    notFound();
  }

  const returnPath = `/projects/${projectId}/daily-log`;
  const totalLoggedHours = workspace.worklogs.reduce(
    (sum, entry) => sum + toNumber(entry.logged_hours),
    0,
  );
  const totalBillableHours = workspace.worklogs.reduce(
    (sum, entry) => sum + toNumber(entry.billable_hours),
    0,
  );
  const totalApprovedHours = workspace.worklogs.reduce(
    (sum, entry) => sum + toNumber(entry.approved_hours),
    0,
  );
  const recentEntries = workspace.worklogs.slice(0, 12);
  const byConsultant = Object.values(
    workspace.worklogs.reduce<Record<string, { consultant: string; entries: number; hours: number }>>(
      (acc, entry) => {
        const key = entry.consultant_username || "Sin usuario";
        acc[key] ??= { consultant: key, entries: 0, hours: 0 };
        acc[key].entries += 1;
        acc[key].hours += toNumber(entry.logged_hours);
        return acc;
      },
      {},
    ),
  ).sort((left, right) => right.hours - left.hours);

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Registros</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{workspace.worklogs.length}</p>
        </div>
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Horas</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{totalLoggedHours.toFixed(2)}</p>
        </div>
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Facturable</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{totalBillableHours.toFixed(2)}</p>
        </div>
        <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Aprobado</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{totalApprovedHours.toFixed(2)}</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard
          title="Nueva jornada"
          description="Registro diario del asesor o implementador para control de horas y entregables."
          action={
            <form action={createWorklogAction} className="space-y-3">
              <input type="hidden" name="return_path" value={returnPath} />
              <input type="hidden" name="project" value={projectId} />

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Plan vinculado
                </label>
                <select name="action_plan" defaultValue="">
                  <option value="">Jornada general del proyecto</option>
                  {workspace.actionPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Fecha
                  </label>
                  <input type="date" name="work_date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Actividad
                  </label>
                  <select name="activity_type" defaultValue="IMPLEMENTACION">
                    {activityOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Titulo
                </label>
                <input name="title" placeholder="Sesion con cliente sobre control documental" required />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Inicio
                  </label>
                  <input type="time" name="start_time" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Fin
                  </label>
                  <input type="time" name="end_time" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Horas registradas
                  </label>
                  <input name="logged_hours" type="number" step="0.25" min="0" placeholder="2.5" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    Horas facturables
                  </label>
                  <input name="billable_hours" type="number" step="0.25" min="0" placeholder="2.5" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Actividad realizada
                </label>
                <textarea name="summary" placeholder="Que se trabajo durante la jornada." />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Entregables
                </label>
                <textarea name="deliverables" placeholder="Documentos, reuniones, decisiones o avances entregados." />
              </div>

              <SubmitButton label="Registrar jornada" pendingLabel="Guardando..." className="w-full" />
            </form>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[20px] bg-sand/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-moss">Hoy</p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {workspace.worklogs.filter((entry) => entry.work_date === new Date().toISOString().slice(0, 10)).length}
              </p>
            </div>
            <div className="rounded-[20px] bg-sand/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-moss">Asesores</p>
              <p className="mt-2 text-xl font-semibold text-ink">{byConsultant.length}</p>
            </div>
            <div className="rounded-[20px] bg-sand/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-moss">Pendiente aprobar</p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {workspace.worklogs.filter((entry) => entry.status === "REGISTRADO").length}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Bitacora diaria">
          {recentEntries.length ? (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <article key={entry.id} className="rounded-[22px] border border-black/8 bg-white/78 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-moss">
                          {entry.consultant_username} - {formatDate(entry.work_date)}
                        </p>
                        <StatusBadge value={entry.status} />
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-ink">{entry.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-ink/72">{entry.summary || "Sin detalle."}</p>
                    </div>
                    <div className="grid min-w-[180px] grid-cols-3 gap-2 text-center">
                      <div className="rounded-[16px] bg-sand/75 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Horas</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{entry.logged_hours}</p>
                      </div>
                      <div className="rounded-[16px] bg-sand/75 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Fact.</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{entry.billable_hours}</p>
                      </div>
                      <div className="rounded-[16px] bg-sand/75 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Apr.</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{entry.approved_hours}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Tipo</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{entry.activity_type}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Plan</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {entry.action_plan_title || "General"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Registro</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(entry.created_at)}</p>
                    </div>
                  </div>

                  {entry.deliverables ? (
                    <div className="mt-4 rounded-[18px] bg-sand/70 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-moss">Entregables</p>
                      <p className="mt-2 text-sm leading-6 text-ink/72">{entry.deliverables}</p>
                    </div>
                  ) : null}

                  {currentUser?.is_staff && entry.status === "REGISTRADO" ? (
                    <div className="mt-4 grid gap-3 rounded-[18px] border border-signal/12 bg-white/84 px-4 py-4 md:grid-cols-[1fr_auto]">
                      <form action={reviewWorklogAction} className="grid gap-3 md:grid-cols-[140px_1fr]">
                        <input type="hidden" name="return_path" value={returnPath} />
                        <input type="hidden" name="worklog_id" value={entry.id} />
                        <input type="hidden" name="transition" value="approve" />
                        <input
                          name="approved_hours"
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={entry.billable_hours}
                        />
                        <input name="review_notes" placeholder="Nota de aprobacion" />
                        <div className="md:col-span-2">
                          <SubmitButton label="Aprobar horas" pendingLabel="..." />
                        </div>
                      </form>
                      <form action={reviewWorklogAction}>
                        <input type="hidden" name="return_path" value={returnPath} />
                        <input type="hidden" name="worklog_id" value={entry.id} />
                        <input type="hidden" name="transition" value="observe" />
                        <input type="hidden" name="review_notes" value="Requiere ajuste o soporte adicional." />
                        <SubmitButton label="Observar" pendingLabel="..." />
                      </form>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin jornadas registradas"
              description="Aqui quedara el registro diario del asesor para control de horas, accion y reporte."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Horas por asesor">
        {byConsultant.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byConsultant.map((item) => (
              <div key={item.consultant} className="rounded-[22px] border border-black/8 bg-white/78 p-4">
                <p className="text-sm font-semibold text-ink">{item.consultant}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
                  {item.entries} registro(s)
                </p>
                <p className="mt-3 text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                  {item.hours.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin carga horaria"
            description="Cuando el asesor registre jornadas, aqui veras el resumen consolidado por persona."
          />
        )}
      </SectionCard>
    </div>
  );
}
