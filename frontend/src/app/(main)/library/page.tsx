import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getLibraryData } from "@/lib/api";
import { formatDate } from "@/lib/presentation";
import { deleteReferenceDocumentAction, uploadReferenceDocumentAction } from "./actions";

export const metadata: Metadata = { title: "Biblioteca — Normador" };

const DOCUMENT_TYPES = [
  { value: "POLITICA", label: "Política" },
  { value: "PROCEDIMIENTO", label: "Procedimiento" },
  { value: "FORMATO", label: "Formato" },
  { value: "REGISTRO", label: "Registro" },
  { value: "MATRIZ", label: "Matriz" },
  { value: "INFORME", label: "Informe" },
  { value: "ACTA", label: "Acta" },
  { value: "EVIDENCIA", label: "Evidencia" },
  { value: "OTRO", label: "Otro" },
];

const STATUS_LABELS: Record<string, string> = {
  CARGADO: "Cargado",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  FALLIDO: "Fallido",
  ARCHIVADO: "Archivado",
};

const STATUS_COLORS: Record<string, string> = {
  CARGADO: "bg-sand/80 text-ink/60",
  PROCESANDO: "bg-blue-50 text-blue-700",
  LISTO: "bg-green-50 text-green-700",
  FALLIDO: "bg-red-50 text-red-700",
  ARCHIVADO: "bg-ink/8 text-ink/40",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const data = await getLibraryData();

  const active = data.documents.filter((d) => d.status !== "ARCHIVADO");
  const archived = data.documents.filter((d) => d.status === "ARCHIVADO");

  return (
    <div className="space-y-6">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <SectionCard
        title="Biblioteca de referencia"
        description="Documentos globales (normas, procedimientos modelo, registros de implementaciones previas) que el sistema usa como contexto al revisar documentos de clientes."
      >
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Upload form */}
          <form action={uploadReferenceDocumentAction} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Título (opcional)
              </label>
              <input
                name="title"
                type="text"
                placeholder="Se toma del nombre del archivo si se omite"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Tipo de documento
              </label>
              <select name="document_type" defaultValue="OTRO">
                {DOCUMENT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Archivo
              </label>
              <input
                name="file"
                type="file"
                accept=".pdf,.docx,.txt,.xlsx"
                required
                className="w-full cursor-pointer rounded-2xl border border-black/8 bg-white/70 px-4 py-3 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:font-semibold file:text-sand"
              />
              <p className="mt-1.5 text-xs text-ink/45">PDF, DOCX, TXT o XLSX · Máx. 20 MB</p>
            </div>
            <SubmitButton
              label="Subir a biblioteca"
              pendingLabel="Subiendo..."
              className="w-full"
            />
          </form>

          {/* Info panel */}
          <div className="rounded-[24px] border border-black/8 bg-sand/72 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Cómo funciona
            </p>
            <h3
              className="mt-2 text-2xl font-bold text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Contexto para el LLM
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-ink/72">
              <li>
                <span className="font-semibold text-ink">Checklist inteligente</span> — el modelo
                genera requisitos usando la norma más los documentos de referencia como ejemplos.
              </li>
              <li>
                <span className="font-semibold text-ink">Revisión de documentos</span> — al
                analizar un documento del cliente, el sistema incluye fragmentos de la biblioteca
                para comparar contra implementaciones previas.
              </li>
              <li>
                <span className="font-semibold text-ink">Formatos recomendados</span> — sube
                normas ISO en PDF, procedimientos modelo en DOCX y registros completos en PDF.
              </li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={`Documentos activos (${active.length})`}
        description="Están indexados y disponibles como contexto en revisiones."
      >
        {active.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map((doc) => (
              <article
                key={doc.id}
                className="rounded-[24px] border border-black/8 bg-sand/75 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                      {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ??
                        doc.document_type}
                    </p>
                    <h3
                      className="mt-1 truncate text-lg font-bold text-ink"
                      style={{ fontFamily: "var(--font-display)" }}
                      title={doc.title}
                    >
                      {doc.title}
                    </h3>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      STATUS_COLORS[doc.status] ?? "bg-sand text-ink/60",
                    ].join(" ")}
                  >
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-ink/40">Fragmentos</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{doc.chunk_count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-ink/40">Subido</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                </div>
                {doc.processing_error && (
                  <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                    {doc.processing_error}
                  </p>
                )}
                <form action={deleteReferenceDocumentAction} className="mt-3">
                  <input type="hidden" name="document_id" value={doc.id} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Eliminar de biblioteca
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Biblioteca vacía"
            description="Sube el primer documento de referencia para que el LLM lo use como contexto."
          />
        )}
      </SectionCard>

      {archived.length > 0 && (
        <SectionCard
          title={`Archivados (${archived.length})`}
          description="Ya no se usan como contexto en revisiones."
        >
          <div className="flex flex-col gap-2">
            {archived.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-ink/3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink/50" title={doc.title}>
                    {doc.title}
                  </p>
                  <p className="text-xs text-ink/35">{formatDate(doc.uploaded_at)}</p>
                </div>
                <span className="shrink-0 text-xs text-ink/35">Archivado</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
