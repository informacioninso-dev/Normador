import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createWorklogAction,
  createWorklogEvidenceAction,
  reviewWorklogAction,
} from "@/app/actions";
import { DailyLogAiAssistant } from "@/components/daily-log-ai-assistant";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { PrintButton } from "@/components/print-button";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getCurrentUser, getProjectWorkspace } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/presentation";
import type { WorkLogEntry } from "@/lib/types";

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

const timeOptions = Array.from({ length: 24 * 12 }, (_, index) => {
  const totalMinutes = index * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

const logViews = [
  { key: "bitacora", label: "Bitacora" },
  { key: "nuevo", label: "Nuevo" },
  { key: "horas", label: "Horas" },
  { key: "informe", label: "Informe" },
] as const;

type LogView = (typeof logViews)[number]["key"];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectedView(value?: string | string[]): LogView {
  const raw = Array.isArray(value) ? value[0] : value;
  return logViews.some((view) => view.key === raw) ? (raw as LogView) : "bitacora";
}

function timeToMinutes(value?: string | null) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return 24 * 60;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function compareBySchedule(left: WorkLogEntry, right: WorkLogEntry) {
  const dateOrder = right.work_date.localeCompare(left.work_date);
  if (dateOrder !== 0) {
    return dateOrder;
  }

  const startOrder = timeToMinutes(left.start_time) - timeToMinutes(right.start_time);
  if (startOrder !== 0) {
    return startOrder;
  }

  return left.id - right.id;
}

function timeRange(entry: WorkLogEntry) {
  if (!entry.start_time || !entry.end_time) {
    return "Sin horario";
  }

  return `${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}`;
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
  const activeView = selectedView(query.view);
  const projectId = Number(routeParams.projectId);

  if (!Number.isFinite(projectId)) {
    notFound();
  }

  const [workspace, currentUser] = await Promise.all([
    getProjectWorkspace(projectId),
    getCurrentUser(),
  ]);

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
  const pendingApproval = workspace.worklogs.filter((entry) => entry.status === "REGISTRADO").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = workspace.worklogs.filter((entry) => entry.work_date === today).length;
  const orderedWorklogs = [...workspace.worklogs].sort(compareBySchedule);
  const groupedEntries: Array<{ date: string; entries: WorkLogEntry[] }> = [];
  for (const entry of orderedWorklogs) {
    const group = groupedEntries[groupedEntries.length - 1];
    if (!group || group.date !== entry.work_date) {
      groupedEntries.push({ date: entry.work_date, entries: [entry] });
    } else {
      group.entries.push(entry);
    }
  }
  const byConsultant = Object.values(
    workspace.worklogs.reduce<Record<string, { consultant: string; entries: number; logged: number; billable: number; approved: number }>>(
      (acc, entry) => {
        const key = entry.consultant_username || "Sin usuario";
        acc[key] ??= { consultant: key, entries: 0, logged: 0, billable: 0, approved: 0 };
        acc[key].entries += 1;
        acc[key].logged += toNumber(entry.logged_hours);
        acc[key].billable += toNumber(entry.billable_hours);
        acc[key].approved += toNumber(entry.approved_hours);
        return acc;
      },
      {},
    ),
  ).sort((left, right) => right.logged - left.logged);

  const kpis = [
    { label: "Registros", value: workspace.worklogs.length },
    { label: "Horas", value: totalLoggedHours.toFixed(2) },
    { label: "Facturable", value: totalBillableHours.toFixed(2) },
    { label: "Aprobado", value: totalApprovedHours.toFixed(2) },
  ];

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />
      <DailyLogAiAssistant projectId={projectId} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="ui-card rounded-[18px] p-3 md:p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-ink md:text-2xl">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="no-print flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {logViews.map((view) => (
            <Link
              key={view.key}
              href={`${returnPath}?view=${view.key}`}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                activeView === view.key
                  ? "ui-pill-active"
                  : "ui-pill text-ink hover:bg-[#edf3ff]",
              ].join(" ")}
            >
              {view.label}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:flex">
          <span className="ui-pill rounded-full px-3 py-2 text-ink/70">Hoy {todayEntries}</span>
          <span className="ui-pill rounded-full px-3 py-2 text-ink/70">
            Por aprobar {pendingApproval}
          </span>
        </div>
      </div>

      {activeView === "nuevo" ? (
        <SectionCard title="Nueva jornada">
          <form
            action={createWorklogAction}
            encType="multipart/form-data"
            className="grid gap-4 lg:grid-cols-2"
          >
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project" value={projectId} />

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Plan
              </label>
              <select name="action_plan" defaultValue="">
                <option value="">Jornada general</option>
                {workspace.actionPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
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

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Fecha
              </label>
              <input type="date" name="work_date" defaultValue={today} />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Titulo
              </label>
              <input name="title" placeholder="Sesion con cliente" required />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Inicio
                </label>
                <select name="start_time" defaultValue="">
                  <option value="">Sin hora</option>
                  {timeOptions.map((time) => (
                    <option key={`start-${time}`} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Fin
                </label>
                <select name="end_time" defaultValue="">
                  <option value="">Sin hora</option>
                  {timeOptions.map((time) => (
                    <option key={`end-${time}`} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Horas
                </label>
                <input name="logged_hours" type="number" step="0.25" min="0" placeholder="2.5" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Facturable
                </label>
                <input name="billable_hours" type="number" step="0.25" min="0" placeholder="2.5" />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Actividad realizada
              </label>
              <textarea name="summary" placeholder="Trabajo realizado durante la jornada." />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Entregables
              </label>
              <textarea name="deliverables" placeholder="Documentos, acuerdos o avances entregados." />
            </div>

            <div className="ui-muted rounded-[18px] p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Soporte opcional
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Adjunta una foto, PDF o archivo de respaldo para pagos por horas.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                <input name="support_title" placeholder="Titulo del soporte" />
                <input
                  type="file"
                  name="support_photo"
                  accept="image/*"
                  capture="environment"
                  aria-label="Tomar foto"
                />
                <input
                  type="file"
                  name="support_file"
                  accept="image/*,.pdf,.docx,.xlsx,.txt"
                  aria-label="Subir archivo"
                />
              </div>
              <textarea
                name="support_notes"
                className="mt-3 min-h-[88px]"
                placeholder="Nota opcional del soporte."
              />
            </div>

            <div className="lg:col-span-2">
              <SubmitButton label="Registrar jornada" pendingLabel="Guardando..." className="w-full" />
            </div>
          </form>
        </SectionCard>
      ) : null}

      {activeView === "bitacora" ? (
        <SectionCard
          title="Bitacora"
          description="Actividades ordenadas por fecha y hora de ejecucion."
          action={
            <Link
              href={`${returnPath}?view=informe`}
              className="block rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-sand transition hover:bg-ink/90"
            >
              Ver informe
            </Link>
          }
        >
          {groupedEntries.length ? (
            <div className="space-y-5">
              {groupedEntries.map((group) => (
                <div key={group.date} className="space-y-3">
                  <div className="sticky top-[168px] z-10 rounded-full border border-black/8 bg-sand px-4 py-2 text-sm font-bold text-ink shadow-[0_12px_28px_rgba(27,37,84,0.08)] lg:top-4">
                    {formatDate(group.date)}
                  </div>

                  {group.entries.map((entry) => (
                    <article key={entry.id} className="rounded-[18px] border border-black/8 bg-white/78 p-4">
                      <div className="grid gap-4 lg:grid-cols-[96px_1fr_auto]">
                        <div className="rounded-[16px] bg-ink px-3 py-3 text-center text-sand">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-sand/60">Horario</p>
                          <p className="mt-1 text-sm font-bold">{timeRange(entry)}</p>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-moss">
                              {entry.consultant_username}
                            </p>
                            <StatusBadge value={entry.status} />
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-ink">{entry.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-ink/72">{entry.summary || "Sin detalle."}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[210px]">
                          <div className="rounded-[14px] bg-sand/75 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Horas</p>
                            <p className="mt-1 text-sm font-semibold text-ink">{entry.logged_hours}</p>
                          </div>
                          <div className="rounded-[14px] bg-sand/75 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Fact</p>
                            <p className="mt-1 text-sm font-semibold text-ink">{entry.billable_hours}</p>
                          </div>
                          <div className="rounded-[14px] bg-sand/75 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Apr</p>
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
                        <div className="mt-4 rounded-[14px] bg-sand/70 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-moss">Entregables</p>
                          <p className="mt-2 text-sm leading-6 text-ink/72">{entry.deliverables}</p>
                        </div>
                      ) : null}

                      <details className="mt-4 rounded-[16px] border border-signal/12 bg-white/78 p-3">
                        <summary className="cursor-pointer list-none text-sm font-bold text-ink">
                          Soportes de horas ({entry.evidence_count})
                        </summary>
                        <div className="mt-3 space-y-3">
                          {workspace.worklogEvidences
                            .filter((evidence) => evidence.worklog === entry.id)
                            .map((evidence) => (
                              <a
                                key={evidence.id}
                                href={evidence.file}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 rounded-[14px] bg-sand/70 px-3 py-2 text-sm text-ink transition hover:bg-sand"
                              >
                                <span className="min-w-0 truncate font-semibold">
                                  {evidence.title || evidence.file_name}
                                </span>
                                <span className="shrink-0 text-xs text-ink/50">
                                  {formatDate(evidence.uploaded_at)}
                                </span>
                              </a>
                            ))}
                          {!entry.evidence_count ? (
                            <p className="text-sm text-ink/55">
                              Sin soportes. Opcional para pagos o trazabilidad de horas.
                            </p>
                          ) : null}
                          <form
                            action={createWorklogEvidenceAction}
                            encType="multipart/form-data"
                            className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                          >
                            <input type="hidden" name="return_path" value={returnPath} />
                            <input type="hidden" name="worklog" value={entry.id} />
                            <input name="title" placeholder="Foto, acta o soporte" />
                            <input
                              type="file"
                              name="photo"
                              accept="image/*"
                              capture="environment"
                              aria-label="Tomar foto"
                            />
                            <input
                              type="file"
                              name="file"
                              accept="image/*,.pdf,.docx,.xlsx,.txt"
                              aria-label="Subir archivo"
                            />
                            <SubmitButton
                              label="Subir"
                              pendingLabel="..."
                              className="w-full md:min-w-[96px]"
                            />
                          </form>
                        </div>
                      </details>

                      {currentUser?.is_staff && entry.status === "REGISTRADO" ? (
                        <div className="mt-4 grid gap-3 rounded-[14px] border border-signal/12 bg-white/84 p-3 md:grid-cols-[1fr_auto]">
                          <form action={reviewWorklogAction} className="grid gap-3 md:grid-cols-[120px_1fr_auto]">
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
                            <input name="review_notes" placeholder="Nota" />
                            <SubmitButton label="Aprobar" pendingLabel="..." className="w-full" />
                          </form>
                          <form action={reviewWorklogAction}>
                            <input type="hidden" name="return_path" value={returnPath} />
                            <input type="hidden" name="worklog_id" value={entry.id} />
                            <input type="hidden" name="transition" value="observe" />
                            <input type="hidden" name="review_notes" value="Requiere ajuste o soporte adicional." />
                            <SubmitButton label="Observar" pendingLabel="..." className="w-full" />
                          </form>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin jornadas" description="Todavia no hay registros diarios." />
          )}
        </SectionCard>
      ) : null}

      {activeView === "informe" ? (
        <section className="print-card rounded-[28px] border border-black/8 bg-white/90 p-4 shadow-[0_18px_50px_rgba(14,20,32,0.07)] backdrop-blur md:p-6">
          <div className="no-print mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link
              href={`${returnPath}?view=bitacora`}
              className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-sand"
            >
              Volver a bitacora
            </Link>
            <div className="md:w-[220px]">
              <PrintButton />
            </div>
          </div>

          <div className="border-b border-black/10 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Informe de bitacora
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h1
                  className="text-2xl font-bold text-ink md:text-4xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {workspace.project.name}
                </h1>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  {workspace.project.company_name} - {workspace.project.standard_name}
                </p>
              </div>
              <div className="rounded-[18px] bg-sand px-4 py-3 text-sm text-ink/72">
                <p className="font-semibold text-ink">Generado</p>
                <p>{formatDate(today)}</p>
              </div>
            </div>
          </div>

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((item) => (
              <div key={`report-${item.label}`} className="rounded-[16px] border border-black/8 bg-sand/55 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink/48">{item.label}</p>
                <p className="mt-1 text-xl font-bold text-ink">{item.value}</p>
              </div>
            ))}
          </section>

          <div className="mt-6 overflow-hidden rounded-[18px] border border-black/8">
            <div className="hidden grid-cols-[92px_1fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-black/8 bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-sand/80 md:grid">
              <span>Hora</span>
              <span>Actividad</span>
              <span>Asesor</span>
              <span>Horas</span>
              <span>Estado</span>
            </div>

            {orderedWorklogs.length ? (
              orderedWorklogs.map((entry) => (
                <div
                  key={`report-entry-${entry.id}`}
                  className="grid gap-3 border-b border-black/7 px-4 py-4 last:border-b-0 md:grid-cols-[92px_1fr_0.7fr_0.7fr_0.7fr]"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45 md:hidden">
                      {formatDate(entry.work_date)}
                    </p>
                    <p className="font-bold text-ink">{timeRange(entry)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{entry.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-moss">
                      {formatDate(entry.work_date)} - {entry.activity_type}
                    </p>
                    {entry.summary ? (
                      <p className="mt-2 text-sm leading-6 text-ink/68">{entry.summary}</p>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink/72">{entry.consultant_username}</p>
                  <p className="text-sm font-semibold text-ink">{entry.logged_hours}</p>
                  <p className="text-sm font-semibold text-ink">{entry.status}</p>
                </div>
              ))
            ) : (
              <div className="px-4 py-8">
                <EmptyState title="Sin jornadas" description="No hay actividades para imprimir." />
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeView === "horas" ? (
        <SectionCard title="Horas por asesor">
          {byConsultant.length ? (
            <div className="overflow-hidden rounded-[18px] border border-black/8 bg-white/82">
              <div className="hidden grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-4 border-b border-black/8 bg-sand/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/48 md:grid">
                <span>Asesor</span>
                <span>Registros</span>
                <span>Horas</span>
                <span>Facturable</span>
                <span>Aprobado</span>
              </div>
              {byConsultant.map((item) => (
                <div
                  key={item.consultant}
                  className="grid gap-3 border-b border-black/6 px-4 py-4 last:border-b-0 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.7fr]"
                >
                  <p className="font-semibold text-ink">{item.consultant}</p>
                  <p className="text-sm text-ink/70">{item.entries}</p>
                  <p className="text-sm font-semibold text-ink">{item.logged.toFixed(2)}</p>
                  <p className="text-sm font-semibold text-ink">{item.billable.toFixed(2)}</p>
                  <p className="text-sm font-semibold text-ink">{item.approved.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin carga horaria" description="No hay horas registradas." />
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
