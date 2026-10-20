import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlledDocumentEditor } from "@/components/controlled-document-editor";
import { apiGet } from "@/lib/api";
import type { ControlledDocument, Project } from "@/lib/types";

export default async function ControlledDocumentPage({ params }: { params: Promise<{ projectId: string; documentId: string }> }) {
  const { projectId, documentId } = await params;
  if (!/^\d+$/.test(projectId) || !/^\d+$/.test(documentId)) notFound();
  let document: ControlledDocument;
  let project: Project;
  try {
    [document, project] = await Promise.all([
      apiGet<ControlledDocument>(`/api/controlled-documents/${documentId}/`),
      apiGet<Project>(`/api/projects/${projectId}/`),
    ]);
  } catch {
    notFound();
  }
  if (document.project !== project.id) notFound();
  return <div className="space-y-5">
    <Link href={`/projects/${projectId}/document-control`} className="text-sm font-semibold underline underline-offset-4">Volver al control documental</Link>
    <Link href={`/companies/${project.company}?view=branding`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Configurar logo y encabezado para las nuevas versiones</Link>
    <ControlledDocumentEditor document={document} canEdit={project.can_edit} canValidate={project.can_validate} />
  </div>;
}
