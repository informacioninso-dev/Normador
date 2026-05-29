import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { FlashBanner } from "@/components/flash-banner";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { decodeFlash, getLibraryData } from "@/lib/api";
import { formatDate } from "@/lib/presentation";
import { deleteReferenceDocumentAction, uploadReferenceDocumentAction } from "./actions";

export const metadata: Metadata = { title: "Biblioteca - Normador" };

const documentTypes = [
  ["POLITICA", "Politica"],
  ["PROCEDIMIENTO", "Procedimiento"],
  ["FORMATO", "Formato"],
  ["REGISTRO", "Registro"],
  ["MATRIZ", "Matriz"],
  ["INFORME", "Informe"],
  ["ACTA", "Acta"],
  ["EVIDENCIA", "Evidencia"],
  ["OTRO", "Otro"],
];

const processAreas = [
  "Control documental",
  "Recepcion",
  "Almacenamiento",
  "Producto no conforme",
  "Auditoria interna",
  "Revision por la direccion",
  "Implementacion normativa",
];

const kindLabels: Record<string, string> = {
  NORMA: "Norma",
  ANEXO: "Anexo",
  GUIA: "Guia",
  PLANTILLA: "Plantilla",
  EJEMPLO: "Ejemplo",
  CONTEXTO_EMPRESA: "Contexto empresa",
  OTRO: "Otro",
};

function LibraryUploadForm({
  mode,
  standards,
  companies,
  projects,
}: {
  mode: "standard" | "company";
  standards: Awaited<ReturnType<typeof getLibraryData>>["standards"];
  companies: Awaited<ReturnType<typeof getLibraryData>>["companies"];
  projects: Awaited<ReturnType<typeof getLibraryData>>["projects"];
}) {
  const isStandard = mode === "standard";

  return (
    <form action={uploadReferenceDocumentAction} className="ui-panel rounded-[22px] p-4">
      <input type="hidden" name="library_kind" value={isStandard ? "NORMA" : "CONTEXTO_EMPRESA"} />
      <input type="hidden" name="library_usages" value="REVISION_DOCUMENTOS" />
      <input type="hidden" name="library_usages" value="CONTEXTO_RAG" />
      {isStandard ? <input type="hidden" name="library_usages" value="GENERAR_CHECKLIST" /> : null}

      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          {isStandard ? "Norma y anexos" : "Contexto empresa"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {isStandard ? "Base normativa" : "Base operativa"}
        </h2>
      </div>

      <div className="grid gap-3">
        <input name="title" placeholder="Titulo opcional" />

        {isStandard ? (
          <select name="library_standard" required defaultValue="">
            <option value="" disabled>
              Selecciona norma
            </option>
            {standards.map((standard) => (
              <option key={standard.id} value={standard.id}>
                {standard.name}
              </option>
            ))}
          </select>
        ) : (
          <select name="library_company" required defaultValue="">
            <option value="" disabled>
              Selecciona empresa
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        )}

        {!isStandard ? (
          <select name="library_project" defaultValue="">
            <option value="">Proyecto opcional</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        ) : null}

        <select name="process_area" defaultValue="">
          <option value="">Proceso opcional</option>
          {processAreas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>

        <select name="document_type" defaultValue={isStandard ? "OTRO" : "INFORME"}>
          {documentTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,.xlsx"
          required
          className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:font-semibold file:text-sand"
        />

        <SubmitButton
          label={isStandard ? "Subir norma/anexo" : "Subir contexto"}
          pendingLabel="Subiendo..."
          className="w-full"
        />
      </div>
    </form>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const flash = decodeFlash(query);
  const data = await getLibraryData();

  const active = data.documents.filter((document) => document.status !== "ARCHIVADO");
  const standardDocs = active.filter((document) => document.library_kind !== "CONTEXTO_EMPRESA");
  const companyDocs = active.filter((document) => document.library_kind === "CONTEXTO_EMPRESA");

  return (
    <div className="space-y-5">
      <FlashBanner success={flash.success} error={flash.error || data.errors[0]} />

      <SectionCard title="Biblioteca" description="Vincula archivos a una norma o a una empresa. El sistema usa esos vinculos para checklist y RAG.">
        <div className="grid gap-4 lg:grid-cols-2">
          <LibraryUploadForm
            mode="standard"
            standards={data.standards}
            companies={data.companies}
            projects={data.projects}
          />
          <LibraryUploadForm
            mode="company"
            standards={data.standards}
            companies={data.companies}
            projects={data.projects}
          />
        </div>
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Normas y anexos (${standardDocs.length})`}>
          <DocumentList documents={standardDocs} />
        </SectionCard>
        <SectionCard title={`Contexto empresa (${companyDocs.length})`}>
          <DocumentList documents={companyDocs} />
        </SectionCard>
      </section>
    </div>
  );
}

function DocumentList({
  documents,
}: {
  documents: Awaited<ReturnType<typeof getLibraryData>>["documents"];
}) {
  if (!documents.length) {
    return (
      <EmptyState
        title="Sin documentos"
        description="Carga el primer archivo para alimentar el RAG."
      />
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <article key={document.id} className="ui-card rounded-[20px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                {kindLabels[document.library_kind] ?? document.library_kind}
              </p>
              <h3 className="mt-1 truncate text-lg font-bold text-ink" title={document.title}>
                {document.title}
              </h3>
            </div>
            <StatusBadge value={document.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="ui-muted rounded-[14px] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Vinculo</p>
              <p className="mt-1 truncate font-semibold text-ink">
                {document.library_standard_name ||
                  document.library_company_name ||
                  document.library_project_name ||
                  "General"}
              </p>
            </div>
            <div className="ui-muted rounded-[14px] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">Fragmentos</p>
              <p className="mt-1 font-semibold text-ink">{document.chunk_count}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink/50">{formatDate(document.uploaded_at)}</p>
            <form action={deleteReferenceDocumentAction}>
              <input type="hidden" name="document_id" value={document.id} />
              <button
                type="submit"
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                Eliminar
              </button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
