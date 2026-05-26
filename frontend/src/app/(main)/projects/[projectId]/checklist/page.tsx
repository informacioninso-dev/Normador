import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { groupChecklistByArea } from "@/lib/metrics";

const CRITICALITY_COLOR: Record<string, string> = {
  ALTA: "bg-red-50 text-red-700 border-red-200",
  MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
  BAJA: "bg-green-50 text-green-700 border-green-200",
};

const DOC_STATUS_COLOR: Record<string, string> = {
  CARGADO: "text-ink/50",
  PROCESANDO: "text-blue-600",
  LISTO: "text-green-700",
  FALLIDO: "text-red-600",
  ARCHIVADO: "text-ink/30",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  CARGADO: "Cargado",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  FALLIDO: "Fallido",
  ARCHIVADO: "Archivado",
};

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

  const workspace = await getProjectWorkspace(projectId);
  if (!workspace.project) notFound();

  const groupedAreas = groupChecklistByArea(workspace.checklistItems);

  // Index requirements by id for quick lookup
  const reqById = Object.fromEntries(workspace.requirements.map((r) => [r.id, r]));

  // Summary counts
  const total = workspace.checklistItems.length;
  const closed = workspace.checklistItems.filter((i) => i.status === "CERRADO").length;
  const partial = workspace.checklistItems.filter((i) =>
    ["VALIDADO_DOCUMENTALMENTE", "EN_PROGRESO"].includes(i.status),
  ).length;
  const pending = total - closed - partial;

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[20px] border border-black/8 bg-white/80 px-4 py-4 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Cerrados</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{closed}</p>
          <p className="text-xs text-ink/40">de {total}</p>
        </div>
        <div className="rounded-[20px] border border-black/8 bg-white/80 px-4 py-4 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">En progreso</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{partial}</p>
          <p className="text-xs text-ink/40">con soporte parcial</p>
        </div>
        <div className="rounded-[20px] border border-black/8 bg-white/80 px-4 py-4 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-signal">{pending}</p>
          <p className="text-xs text-ink/40">sin documentos</p>
        </div>
      </div>

      {Object.keys(groupedAreas).length ? (
        Object.entries(groupedAreas).map(([area, items]) => {
          const areaClosed = items.filter((i) => i.status === "CERRADO").length;
          const pct = Math.round((areaClosed / items.length) * 100);

          return (
            <SectionCard
              key={area}
              title={area}
              description={`${areaClosed} de ${items.length} requisitos cerrados — ${pct}% completado`}
            >
              <div className="space-y-4">
                {items.map((item) => {
                  const req = reqById[item.requirement];
                  const itemDocs = workspace.documents.filter(
                    (d) => d.checklist_item === item.id,
                  );
                  const itemEvidences = workspace.evidences.filter(
                    (e) => e.checklist_item === item.id,
                  );
                  const openPlans = workspace.actionPlans.filter(
                    (p) =>
                      p.checklist_item === item.id &&
                      !["CERRADO", "SUPERSEDIDO"].includes(p.status),
                  );

                  const expectedDocs: string[] = req?.expected_documents ?? [];
                  const expectedEvidence: string[] = req?.expected_evidence ?? [];
                  const verificationQs: string[] = req?.verification_questions ?? [];

                  const isClosed = item.status === "CERRADO";

                  return (
                    <details
                      key={item.id}
                      className={[
                        "group rounded-[24px] border bg-white/78",
                        isClosed ? "border-green-200/60" : "border-black/8",
                      ].join(" ")}
                      open={!isClosed}
                    >
                      {/* Summary row — always visible */}
                      <summary className="flex cursor-pointer list-none items-start gap-4 p-5">
                        <div className="mt-0.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-moss">
                              {item.clause}
                            </span>
                            <span
                              className={[
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                CRITICALITY_COLOR[item.criticality] ?? "bg-sand text-ink/60 border-black/8",
                              ].join(" ")}
                            >
                              {item.criticality}
                            </span>
                            {item.is_not_applicable && (
                              <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold text-ink/50">
                                No aplica
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1.5 text-base font-semibold text-ink leading-snug">
                            {item.title}
                          </h3>
                          {/* Mini doc pill count */}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink/50">
                            <span>{itemDocs.length} doc{itemDocs.length !== 1 ? "s" : ""} subidos</span>
                            <span>·</span>
                            <span>{itemEvidences.length} evidencias</span>
                            {openPlans.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-signal font-semibold">{openPlans.length} pendientes</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge value={item.status} />
                        </div>
                      </summary>

                      {/* Expanded body */}
                      <div className="border-t border-black/6 px-5 pb-5 pt-4 space-y-5">
                        {/* Description */}
                        {item.description && (
                          <p className="text-sm leading-6 text-ink/70">{item.description}</p>
                        )}

                        <div className="grid gap-5 md:grid-cols-2">
                          {/* Documentos esperados vs subidos */}
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Documentos requeridos
                            </p>
                            <div className="space-y-1.5">
                              {expectedDocs.length ? (
                                expectedDocs.map((docName, idx) => {
                                  // Check if any uploaded doc title loosely matches
                                  const matched = itemDocs.some((d) =>
                                    d.title.toLowerCase().includes(docName.toLowerCase().slice(0, 8)),
                                  );
                                  return (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className={matched ? "text-green-600" : "text-ink/25"}>
                                        {matched ? "✓" : "○"}
                                      </span>
                                      <span className={["text-sm", matched ? "text-ink/70" : "text-ink/55"].join(" ")}>
                                        {docName}
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-ink/40">Sin lista específica definida.</p>
                              )}
                            </div>

                            {/* Tipo requerido */}
                            <div className="mt-3 flex flex-wrap gap-3">
                              {item.required_document_type && (
                                <div className="rounded-[14px] bg-sand/80 px-3 py-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-ink/40">Tipo doc.</p>
                                  <p className="mt-0.5 text-xs font-semibold text-ink">{item.required_document_type}</p>
                                </div>
                              )}
                              {item.required_evidence_type && (
                                <div className="rounded-[14px] bg-sand/80 px-3 py-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-ink/40">Tipo evidencia</p>
                                  <p className="mt-0.5 text-xs font-semibold text-ink">{item.required_evidence_type}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Documentos subidos */}
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Documentos subidos ({itemDocs.length})
                            </p>
                            {itemDocs.length ? (
                              <div className="space-y-2">
                                {itemDocs.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-2 rounded-[14px] bg-sand/60 px-3 py-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-ink" title={doc.title}>
                                        {doc.title}
                                      </p>
                                      <p className="text-xs text-ink/40">{doc.document_type} · {doc.file_extension}</p>
                                    </div>
                                    <span className={["text-xs font-semibold shrink-0", DOC_STATUS_COLOR[doc.status] ?? ""].join(" ")}>
                                      {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-ink/40">Ningún documento subido aún.</p>
                            )}
                          </div>
                        </div>

                        {/* Evidencia esperada */}
                        {expectedEvidence.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Evidencia de implementación requerida
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {expectedEvidence.map((ev, idx) => {
                                const matched = itemEvidences.some((e) =>
                                  e.title?.toLowerCase().includes(ev.toLowerCase().slice(0, 8)),
                                );
                                return (
                                  <span
                                    key={idx}
                                    className={[
                                      "rounded-full px-3 py-1 text-xs font-semibold border",
                                      matched
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-sand/80 text-ink/60 border-black/8",
                                    ].join(" ")}
                                  >
                                    {matched ? "✓ " : ""}{ev}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Preguntas de verificación */}
                        {verificationQs.length > 0 && (
                          <details className="rounded-[16px] bg-sand/50 px-4 py-3">
                            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                              Preguntas de verificación ({verificationQs.length})
                            </summary>
                            <ul className="mt-3 space-y-2">
                              {verificationQs.map((q, idx) => (
                                <li key={idx} className="flex gap-2 text-sm text-ink/70">
                                  <span className="shrink-0 font-semibold text-moss">{idx + 1}.</span>
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {/* Pendientes abiertos */}
                        {openPlans.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-signal">
                              Planes de acción abiertos ({openPlans.length})
                            </p>
                            <div className="space-y-2">
                              {openPlans.map((plan) => (
                                <div key={plan.id} className="rounded-[14px] border border-signal/20 bg-signal/5 px-3 py-2">
                                  <p className="text-sm font-semibold text-ink">{plan.title}</p>
                                  <p className="mt-0.5 text-xs text-ink/55">{plan.recommended_action}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </SectionCard>
          );
        })
      ) : (
        <SectionCard title="Checklist normativo" description="">
          <EmptyState
            title="No hay items en checklist"
            description="Verifica que el proyecto tenga norma asociada y que el seed de requisitos se haya cargado."
          />
        </SectionCard>
      )}
    </div>
  );
}
