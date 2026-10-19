import { RoleForm } from "@/components/role-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProcessingRefresh } from "@/components/processing-refresh";

import {
  createEvidenceAction,
  confirmNotApplicableAction,
  regenerateChecklistFromLibraryAction,
  runReviewAction,
  uploadDocumentAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { groupChecklistByArea } from "@/lib/metrics";
import type { ChecklistItem } from "@/lib/types";

const ITEM_TYPE_LABELS: Record<string, string> = {
  DOCUMENTO: "Documento",
  EVIDENCIA: "Evidencia",
  ACTIVIDAD: "Actividad",
  CONTROL: "Control",
  DECISION: "Decision",
};

const DOCUMENT_TYPES = [
  "POLITICA",
  "PROCEDIMIENTO",
  "FORMATO",
  "REGISTRO",
  "MATRIZ",
  "INFORME",
  "ACTA",
  "EVIDENCIA",
  "OTRO",
];

const EVIDENCE_TYPES = [
  "REGISTRO_DILIGENCIADO",
  "ACTA",
  "INFORME",
  "CAPACITACION",
  "CONTROL_EJECUTADO",
  "TRAZABILIDAD",
  "OTRO",
];

const CRITICALITY_COLOR: Record<string, string> = {
  ALTA: "border-red-200 bg-red-50 text-red-700",
  MEDIA: "border-amber-200 bg-amber-50 text-amber-700",
  BAJA: "border-green-200 bg-green-50 text-green-700",
};

function firstItems(values: string[], limit = 4) {
  if (!values.length) return ["Criterio definido por el requisito."];
  return values.slice(0, limit);
}

function itemCompletionHints(item: ChecklistItem) {
  const hints = [];
  if (item.requires_document) {
    hints.push(`Documento: ${item.required_document_type || "OTRO"}`);
  }
  if (item.requires_evidence) {
    hints.push(`Evidencia: ${item.required_evidence_type || "OTRO"}`);
  }
  if (!hints.length) {
    hints.push("Actividad verificable");
  }
  return hints;
}

export default async function ProjectChecklistPage({
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

  if (!Number.isFinite(projectId)) notFound();

  const workspace = await getProjectWorkspace(projectId, ["checklistItems","requirements","documents","evidences","actionPlans","reviews"]);
  if (!workspace.project) notFound();

  const basePath = `/projects/${projectId}/checklist`;
  const pick = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const search = pick(query.q).trim();
  const status = pick(query.status);
  const processArea = pick(query.area);
  const filtered = workspace.checklistItems.filter((item) =>
    (!status || item.status === status) && (!processArea || item.process_area === processArea)
    && (!search || `${item.clause} ${item.title} ${item.implementation_task}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(pick(query.page))) || 1));
  const selected = workspace.checklistItems.find((item) => item.id === Number(pick(query.item)));
  function href(changes: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: search, status, area: processArea, page, item: selected?.id, ...changes })) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return `${basePath}?${params.toString()}`;
  }
  const returnPath = href();
  const groupedAreas = groupChecklistByArea(selected ? [selected] : []);
  const reqById = Object.fromEntries(workspace.requirements.map((requirement) => [requirement.id, requirement]));

  const total = workspace.checklistItems.length;
  const closed = workspace.checklistItems.filter((item) => item.status === "CERRADO").length;
  const documentTasks = workspace.checklistItems.filter((item) => item.requires_document).length;
  const evidenceTasks = workspace.checklistItems.filter((item) => item.requires_evidence).length;

  const kpis = [
    { label: "Items", value: total },
    { label: "Cerrados", value: closed },
    { label: "Con documento", value: documentTasks },
    { label: "Con evidencia", value: evidenceTasks },
  ];

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <section className="ui-surface rounded-[22px] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              Checklist operativo
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/70">
              Busca un requisito y abre su detalle para cargar documentos y revisar lo que falta.
              NORMAN compara el soporte documental; la evidencia real de implementación se valida por separado.
            </p>
          </div>
          <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={regenerateChecklistFromLibraryAction} className="md:min-w-[260px]">
            <input type="hidden" name="return_path" value={returnPath} />
            <input type="hidden" name="project_id" value={projectId} />
            <SubmitButton
              label="Actualizar desde biblioteca"
              pendingLabel="Actualizando..."
              className="w-full"
            />
          </RoleForm>
        </div>
      </section>

      <SectionCard title="Localizar un requisito" description="Filtra el checklist y abre un requisito para trabajar sus documentos, revisión y evidencias.">
        <form method="get" action={basePath} className="grid gap-3 md:grid-cols-4">
          <div><label htmlFor="checklist-search">Buscar por cláusula o título</label><input id="checklist-search" name="q" defaultValue={search} type="search" /></div>
          <div><label htmlFor="checklist-status">Estado</label><select id="checklist-status" name="status" defaultValue={status}><option value="">Todos</option>{[...new Set(workspace.checklistItems.map((item) => item.status))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
          <div><label htmlFor="checklist-area">Proceso</label><select id="checklist-area" name="area" defaultValue={processArea}><option value="">Todos</option>{[...new Set(workspace.checklistItems.map((item) => item.process_area))].map((value) => <option key={value} value={value}>{value || "Sin proceso"}</option>)}</select></div>
          <div className="flex items-end gap-3"><SubmitButton label="Filtrar" /><Link className="py-3 underline" href={basePath}>Limpiar</Link></div>
        </form>
        <p className="my-4 text-sm" role="status">{filtered.length} requisitos · Página {page} de {pageCount}</p>
        <ul className="divide-y divide-black/10">{filtered.slice((page - 1) * 10, page * 10).map((item) => <li key={item.id}><Link href={`${href({ item: item.id })}#requirement-${item.id}`} aria-current={selected?.id === item.id ? "true" : undefined} className="flex flex-wrap items-center justify-between gap-3 py-4"><span><strong>{item.clause} · {item.title}</strong><span className="mt-1 block text-sm text-moss">{item.process_area}</span></span><StatusBadge value={item.status} /></Link></li>)}</ul>
        {!filtered.length && <p className="py-4">No hay coincidencias. Prueba otro término o limpia los filtros.</p>}
        <nav aria-label="Páginas del checklist" className="mt-4 flex justify-between gap-4">{page > 1 ? <Link className="py-3 underline" href={href({ page: page - 1, item: undefined })}>Anterior</Link> : <span />}{page < pageCount && <Link className="py-3 underline" href={href({ page: page + 1, item: undefined })}>Siguiente</Link>}</nav>
      </SectionCard>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="ui-card rounded-[18px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/70">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </section>

      {Object.keys(groupedAreas).length ? (
        Object.entries(groupedAreas).map(([area, items]) => {
          const areaClosed = items.filter((item) => item.status === "CERRADO").length;
          const pct = Math.round((areaClosed / items.length) * 100);

          return (
            <SectionCard
              key={area}
              title={area}
              description={`${areaClosed} de ${items.length} cerrados - ${pct}% completado`}
            >
              <div className="space-y-4">
                {items.map((item) => {
                  const requirement = reqById[item.requirement];
                  const itemDocs = workspace.documents.filter(
                    (document) =>
                      document.checklist_item === item.id ||
                      document.requirement === item.requirement,
                  );
                  const readyDocs = itemDocs.filter((document) => document.status === "LISTO");
                  const itemEvidences = workspace.evidences.filter(
                    (evidence) =>
                      evidence.checklist_item === item.id ||
                      evidence.requirement === item.requirement,
                  );
                  const openPlans = workspace.actionPlans.filter(
                    (plan) =>
                      plan.checklist_item === item.id &&
                      !["CERRADO", "SUPERSEDIDO"].includes(plan.status),
                  );
                  const latestReview = workspace.reviews.find((review) =>
                    review.requirement_evaluations.some(
                      (evaluation) => evaluation.requirement === item.requirement,
                    ),
                  );
                  const latestEvaluation = latestReview?.requirement_evaluations.find((evaluation) => evaluation.requirement === item.requirement);

                  return (
                    <article id={`requirement-${item.id}`} key={item.id} className="ui-card scroll-mt-24 rounded-[24px] p-4 md:p-5">
                      <div className="mb-4 flex flex-wrap gap-4"><Link href={href({ item: undefined })} className="underline">Cerrar detalle</Link><Link href={`/projects/${projectId}/reviews?requirement=${item.requirement}`} className="underline">Ver revisiones y citas</Link><Link href={`/projects/${projectId}/evidence?requirement=${item.requirement}`} className="underline">Ver evidencias</Link></div>
                      {itemDocs.filter((document) => document.latest_job).map((document) => <div key={document.id} className="mb-4 rounded-xl bg-sand p-3"><p role="status">{document.title}: {({ PENDING: "En cola", RUNNING: "Procesando", RETRY: "Reintentando", SUCCESS: "Completado", FAILED: "Fallido" })[document.latest_job!.status]} {document.latest_job?.error}</p><Link className="underline" href={`/projects/${projectId}/documents#document-${document.id}`}>Ver documento y procesamiento</Link><ProcessingRefresh active={["PENDING", "RUNNING", "RETRY"].includes(document.latest_job!.status)} /></div>)}
                      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-sand">
                              {item.clause}
                            </span>
                            <span
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-semibold",
                                CRITICALITY_COLOR[item.criticality] ??
                                  "border-signal/16 bg-white text-ink/70",
                              ].join(" ")}
                            >
                              {item.criticality}
                            </span>
                            <span className="ui-pill rounded-full px-3 py-1 text-xs font-semibold text-ink/70">
                              {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                            </span>
                            <StatusBadge value={item.status} />
                          </div>

                          <h3
                            className="mt-3 text-xl font-bold leading-tight text-ink"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {item.title}
                          </h3>

                          <p className="mt-3 text-sm leading-6 text-ink/70">
                            {item.implementation_task || item.description}
                          </p>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {itemCompletionHints(item).map((hint) => (
                              <div key={hint} className="ui-muted rounded-[14px] px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">
                                  Requiere
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">{hint}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="ui-muted rounded-[18px] p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Soporte
                            </p>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-lg font-bold text-ink">{itemDocs.length}</p>
                                <p className="text-[11px] text-ink/70">Docs</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-ink">{itemEvidences.length}</p>
                                <p className="text-[11px] text-ink/70">Evid.</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-ink">{openPlans.length}</p>
                                <p className="text-[11px] text-ink/70">Pend.</p>
                              </div>
                            </div>
                          </div>

                          {latestReview ? (
                            <div className="ui-muted rounded-[18px] p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                                Ultima revision AI
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <StatusBadge value={latestReview.overall_status} />
                                <StatusBadge value={latestReview.risk_level} />
                              </div>
                            </div>
                          ) : null}
                          {latestEvaluation?.status === "NO_APLICA" && !item.is_not_applicable && (
                            <RoleForm allowed={Boolean(workspace.project?.can_validate)} action={confirmNotApplicableAction} className="space-y-3">
                              <input type="hidden" name="return_path" value={`/projects/${projectId}/checklist`} />
                              <input type="hidden" name="checklist_item" value={item.id} />
                              <label htmlFor={`exclusion-${item.id}`} className="block text-sm font-semibold">Justificación de no aplicabilidad</label>
                              <textarea id={`exclusion-${item.id}`} name="justification" required />
                              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmed" required className="h-4 w-4" />Confirmo la revisión humana del alcance.</label>
                              <SubmitButton label="Aprobar no aplicabilidad" pendingLabel="Guardando..." />
                            </RoleForm>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-3">
                        <div className="ui-panel rounded-[18px] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                            Criterios de aceptacion
                          </p>
                          <ul className="mt-3 space-y-2">
                            {firstItems(item.acceptance_criteria).map((criterion) => (
                              <li key={criterion} className="flex gap-2 text-sm leading-6 text-ink/70">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                                <span>{criterion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="ui-panel rounded-[18px] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                            Documentos y revision AI
                          </p>
                          {item.requires_document ? (
                            <>
                              <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={uploadDocumentAction} className="mt-3 space-y-2" encType="multipart/form-data">
                                <input type="hidden" name="return_path" value={returnPath} />
                                <input type="hidden" name="project" value={projectId} />
                                <input type="hidden" name="requirement" value={item.requirement} />
                                <input type="hidden" name="checklist_item" value={item.id} />
                                <input type="hidden" name="auto_review" value="1" />
                                <input aria-label="Título" name="title" placeholder="Politica, manual, POE o registro" />
                                <select aria-label="Tipo de documento" name="document_type" defaultValue={item.required_document_type || "OTRO"}>
                                  {DOCUMENT_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                                <input aria-label="Archivo de soporte" type="file" name="file" accept=".pdf,.docx,.xlsx,.txt" required />
                                <SubmitButton label="Subir y comparar" pendingLabel="Procesando..." className="w-full" />
                              </RoleForm>

                              {readyDocs.length ? (
                                <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={runReviewAction} className="mt-3 space-y-2">
                                  <input type="hidden" name="return_path" value={returnPath} />
                                  <input type="hidden" name="review_type" value="CUMPLIMIENTO_NORMATIVO" />
                                  <input type="hidden" name="requirement" value={item.requirement} />
                                  <select aria-label="Documento para revisar" name="document" defaultValue={readyDocs[0].id}>
                                    {readyDocs.map((document) => (
                                      <option key={document.id} value={document.id}>
                                        Revisar: {document.title}
                                      </option>
                                    ))}
                                  </select>
                                  <SubmitButton label="Comparar con AI" pendingLabel="Revisando..." className="w-full" />
                                </RoleForm>
                              ) : (
                                <p className="mt-3 text-sm leading-6 text-ink/70">
                                  Sube un documento para habilitar la comparacion con AI.
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-ink/70">
                              Este item no exige documento formal; puede cerrarse con actividad o evidencia.
                            </p>
                          )}
                        </div>

                        <div className="ui-panel rounded-[18px] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                            Evidencia operativa
                          </p>
                          {item.requires_evidence ? (
                            <RoleForm allowed={Boolean(workspace.project?.can_edit)} action={createEvidenceAction} className="mt-3 space-y-2" encType="multipart/form-data">
                              <input type="hidden" name="return_path" value={returnPath} />
                              <input type="hidden" name="project" value={projectId} />
                              <input type="hidden" name="requirement" value={item.requirement} />
                              <input type="hidden" name="checklist_item" value={item.id} />
                              <input aria-label="Título" name="title" placeholder="Registro, foto, acta o soporte" required />
                              <select aria-label="Tipo de evidencia" name="evidence_type" defaultValue={item.required_evidence_type || "OTRO"}>
                                {EVIDENCE_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <input aria-label="Archivo de soporte" type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png" />
                              <SubmitButton label="Subir evidencia" pendingLabel="Guardando..." className="w-full" />
                            </RoleForm>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-ink/70">
                              No requiere evidencia operativa adicional segun el criterio actual.
                            </p>
                          )}
                        </div>
                      </div>

                      <details className="mt-4 rounded-[18px] bg-[#eef4ff] px-4 py-3">
                        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                          Criterio AI y preguntas de verificacion
                        </summary>
                        <p className="mt-3 text-sm leading-6 text-ink/70">
                          {item.ai_review_focus || requirement?.requirement_text}
                        </p>
                        <ul className="mt-3 space-y-2">
                          {firstItems(item.review_questions, 6).map((question) => (
                            <li key={question} className="flex gap-2 text-sm leading-6 text-ink/70">
                              <span className="font-bold text-signal">?</span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </article>
                  );
                })}
              </div>
            </SectionCard>
          );
        })
      ) : total === 0 ? (
        <SectionCard title="Checklist operativo">
          <EmptyState
            title="No hay items en checklist"
            description="Actualiza desde biblioteca o verifica que el proyecto tenga una norma asociada."
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
