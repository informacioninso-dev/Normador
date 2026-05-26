import { notFound } from "next/navigation";

import { createEvidenceAction, validateEvidenceAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getProjectWorkspace } from "@/lib/api";
import { formatDateTime } from "@/lib/presentation";

const evidenceTypes = [
  "REGISTRO_DILIGENCIADO",
  "ACTA",
  "INFORME",
  "CAPACITACION",
  "CONTROL_EJECUTADO",
  "TRAZABILIDAD",
  "OTRO",
];

export default async function ProjectEvidencePage({
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

  const returnPath = `/projects/${projectId}/evidence`;
  const pendingEvidence = workspace.evidences.filter(
    (evidence) => evidence.status === "CARGADA",
  );
  const validatedEvidence = workspace.evidences.filter(
    (evidence) => evidence.status === "VALIDADA",
  );

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || workspace.errors[0]} />

      <SectionCard
        title="Registrar evidencia"
        description="Sube evidencia operativa real que demuestre implementacion. Sin evidencia validada, el requisito no puede cerrarse."
        action={
          <form action={createEvidenceAction} className="space-y-3" encType="multipart/form-data">
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
              <input name="title" placeholder="Acta de revision por la direccion" required />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Tipo de evidencia
              </label>
              <select name="evidence_type" required defaultValue="OTRO">
                {evidenceTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Fecha de ocurrencia
              </label>
              <input type="date" name="occurred_on" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Archivo
              </label>
              <input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.jpg,.png" />
            </div>
            <SubmitButton label="Registrar evidencia" pendingLabel="Guardando..." className="w-full" />
          </form>
        }
      >
        <div className="space-y-3">
          {pendingEvidence.length ? (
            pendingEvidence.map((evidence) => (
              <article
                key={evidence.id}
                className="rounded-[26px] border border-black/8 bg-white/78 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {evidence.evidence_type} · {evidence.clause || "Sin clausula"}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{evidence.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink/45">
                      {formatDateTime(evidence.uploaded_at)}
                    </p>
                  </div>
                  <StatusBadge value={evidence.status} />
                </div>

                <div className="mt-4 flex gap-2">
                  <form action={validateEvidenceAction}>
                    <input type="hidden" name="return_path" value={returnPath} />
                    <input type="hidden" name="evidence_id" value={evidence.id} />
                    <input type="hidden" name="transition" value="validate_evidence" />
                    <SubmitButton label="Validar" pendingLabel="..." />
                  </form>
                  <form action={validateEvidenceAction}>
                    <input type="hidden" name="return_path" value={returnPath} />
                    <input type="hidden" name="evidence_id" value={evidence.id} />
                    <input type="hidden" name="transition" value="reject_evidence" />
                    <SubmitButton label="Rechazar" pendingLabel="..." />
                  </form>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="No hay evidencia pendiente de validacion"
              description="Registra evidencia operativa real para avanzar del estado documental al estado implementado."
            />
          )}
        </div>
      </SectionCard>

      {validatedEvidence.length > 0 && (
        <SectionCard title="Evidencia validada" description="Evidencia que ya fue revisada y aceptada.">
          <div className="space-y-3">
            {validatedEvidence.map((evidence) => (
              <div key={evidence.id} className="rounded-[22px] bg-sand/75 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{evidence.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
                      {evidence.evidence_type} · {evidence.clause || "Sin clausula"}
                    </p>
                  </div>
                  <StatusBadge value={evidence.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
