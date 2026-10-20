import Link from "next/link";

import { confirmNotApplicableAction, createEvidenceAction, runReviewAction, uploadDocumentAction, validateEvidenceAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { ProcessingRefresh } from "@/components/processing-refresh";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateTime } from "@/lib/presentation";
import type { ChecklistItem, ProjectWorkspace } from "@/lib/types";
import { activeJobStates, evidenceTypes, requirementStatusHelp, requirementSteps, requirementSupport, supportTypes, taskLabel, type RequirementStep } from "@/lib/workflow";

export function RequirementWorkspace({ workspace, item, step, listQuery }: { workspace: ProjectWorkspace; item: ChecklistItem; step: RequirementStep; listQuery: string }) {
  const project = workspace.project!;
  const support = requirementSupport(item, workspace.documents, workspace.reviews, workspace.evidences);
  const readyDocuments = support.documents.filter((document) => document.status === "LISTO" && !activeJobStates.includes(document.latest_job?.status ?? ""));
  const latestReview = support.reviews[0];
  const evaluation = latestReview?.requirement_evaluations.find((result) => result.requirement === item.requirement);
  const requirement = workspace.requirements.find((candidate) => candidate.id === item.requirement);
  const plans = workspace.actionPlans.filter((plan) => (plan.checklist_item === item.id || plan.requirement === item.requirement) && !["CERRADO", "SUPERSEDIDO"].includes(plan.status));
  const basePath = `/projects/${project.id}/checklist`;
  const href = (next: RequirementStep) => {
    const params = new URLSearchParams(listQuery); params.set("item", String(item.id)); params.set("step", next);
    return `${basePath}?${params}`;
  };
  const returnPath = href(step);
  const contextFields = <><input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="project" value={project.id} /><input type="hidden" name="requirement" value={item.requirement} /><input type="hidden" name="checklist_item" value={item.id} /></>;

  return <div id={`requirement-${item.id}`} className="space-y-5 scroll-mt-4">
    <Link href={`${basePath}${listQuery ? `?${listQuery}` : ""}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Volver a los requisitos del proyecto</Link>
    <section className="ui-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="max-w-3xl text-2xl font-bold">{item.clause} · {item.title}</h2><StatusBadge value={item.status} /></div>
      <p className="mt-2 text-sm text-ink/70">{item.process_area} · {item.criticality === "ALTA" ? "Criticidad alta" : item.criticality === "MEDIA" ? "Criticidad media" : "Criticidad baja"}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6">{requirementStatusHelp[item.status] ?? "Consulta los soportes y el estado registrado de este requisito."}</p>
      <nav aria-label="Trabajo del requisito" className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{requirementSteps.map((section) => <Link key={section.value} href={href(section.value)} aria-current={step === section.value ? "step" : undefined} className={`inline-flex min-h-12 items-center rounded-xl px-3 py-3 text-sm font-semibold ${step === section.value ? "ui-pill-active" : "ui-pill text-ink/70 hover:bg-sand"}`}>{section.label}</Link>)}</nav>
    </section>

    {support.documents.filter((document) => document.latest_job && document.latest_job.status !== "SUCCESS").map((document) => <div key={document.id} className="rounded-xl border border-ink/15 bg-white p-4">
      <p role="status" className="font-semibold">{document.title} · {({ PENDING: "En espera para procesar", RUNNING: "NORMAN está procesando el documento", RETRY: "Se está reintentando el procesamiento", FAILED: "El procesamiento no se completó", SUCCESS: "Procesamiento completado" })[document.latest_job!.status]}</p>
      {document.latest_job?.error && <p role="alert" className="mt-2 text-sm">{document.latest_job.error}</p>}
      <p className="mt-2 text-sm text-ink/70">Puedes salir y volver. El resultado aparecerá aquí cuando termine.</p>
      <Link href={`/projects/${project.id}/documents#document-${document.id}`} className="inline-flex min-h-11 items-center text-sm text-signal underline">Ver documento y opciones de recuperación</Link>
      <ProcessingRefresh active={activeJobStates.includes(document.latest_job!.status)} />
    </div>)}

    {step === "understand" && <SectionCard title="Qué debes demostrar" description={item.implementation_task || item.description || requirement?.requirement_text}>
      <h3 className="font-semibold">Criterios de aceptación</h3>
      {item.acceptance_criteria.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{item.acceptance_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul> : <p className="mt-2 text-sm text-ink/70">Consulta el criterio del requisito antes de aportar el soporte.</p>}
      <dl className="mt-5 space-y-3 text-sm"><div><dt className="font-semibold">Documentación</dt><dd className="mt-1 text-ink/70">{item.requires_document ? `Se requiere ${taskLabel(item.required_document_type || "OTRO")}.` : "El criterio no exige un documento formal adicional."}</dd></div><div><dt className="font-semibold">Evidencia de implementación</dt><dd className="mt-1 text-ink/70">{item.requires_evidence || item.requires_real_evidence ? `Debe demostrarse la ejecución real con ${taskLabel(item.required_evidence_type || "OTRO")}. El soporte necesita validación humana.` : "Consulta las condiciones de cierre de este requisito y las acciones pendientes."}</dd></div></dl>
      {item.review_questions.length > 0 && <details className="mt-5"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Preguntas para comprobar el requisito</summary><ul className="list-disc space-y-2 pl-5 text-sm">{item.review_questions.map((question, index) => <li key={index}>{question}</li>)}</ul></details>}
      {item.status !== "CERRADO" && <Link href={href(project.can_edit ? item.requires_document ? "documents" : "evidence" : "review")} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-white">{project.can_edit ? item.requires_document ? "Continuar con la documentación" : "Ver evidencia de implementación" : "Consultar el resultado de la revisión"}</Link>}
      {item.status === "CERRADO" && <Link href={href("review")} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Consultar el soporte del cierre</Link>}
    </SectionCard>}

    {step === "documents" && <SectionCard title="Documentación del requisito" description="Sube el documento que respalda este requisito. NORMAN lo revisará y señalará las citas y los faltantes; el resultado no sustituye la evidencia de ejecución.">
      {support.documents.length > 0 && <ul className="mb-5 divide-y divide-ink/10">{support.documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><a href={`/api/files/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-signal underline">Abrir {document.title} (nueva pestaña)</a><p className="text-sm text-ink/70">{taskLabel(document.document_type)}</p></div><StatusBadge value={document.status} /></li>)}</ul>}
      {project.can_edit ? <ActionForm action={uploadDocumentAction} className="grid gap-4 border-t border-ink/10 pt-5 md:grid-cols-2">
        {contextFields}<input type="hidden" name="auto_review" value="1" />
        <FormField label="Archivo del documento"><input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt" required aria-describedby="requirement-file-help" /></FormField>
        <FormField label="Tipo de documento"><select name="document_type" defaultValue={supportTypes.includes(item.required_document_type) ? item.required_document_type : "OTRO"}>{supportTypes.map((type) => <option key={type} value={type}>{taskLabel(type)}</option>)}</select></FormField>
        <FormField label="Título (opcional)"><input name="title" placeholder="Se utilizará el nombre del archivo si lo dejas vacío" /></FormField>
        <p id="requirement-file-help" className="text-sm text-ink/70 md:col-span-2">Word, Excel, PDF con texto o TXT. Las correcciones se cargan como un documento nuevo y conservan el historial.</p>
        <div className="md:col-span-2"><SubmitButton label="Subir y revisar este requisito" pendingLabel="Enviando documento..." /></div>
      </ActionForm> : <p className="text-sm text-ink/70">Puedes consultar y descargar los documentos. La carga corresponde al responsable o implementador de la empresa.</p>}
      <Link href={href("review")} className="mt-5 inline-flex min-h-11 items-center font-semibold text-signal underline">Ver resultado de la revisión</Link>
    </SectionCard>}

    {step === "review" && <SectionCard title="Resultado de la revisión" description="Comprueba qué encontró NORMAN en el documento y qué falta antes de corregir o continuar.">
      {evaluation && latestReview ? <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><StatusBadge value={evaluation.status} /><StatusBadge value={evaluation.risk_level} /></div>
        <p className="whitespace-pre-wrap text-sm leading-6">{evaluation.recommendation || evaluation.gap || latestReview.summary}</p>
        <div><h3 className="font-semibold">Soporte citado en el documento</h3>{evaluation.evidence_found ? <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-sand p-4 text-sm leading-6">{evaluation.evidence_found}</blockquote> : <p className="mt-2 text-sm text-ink/70">La evaluación no identificó una cita documental que respalde este requisito.</p>}</div>
        {evaluation.gap && <p className="whitespace-pre-wrap text-sm"><strong>Brecha identificada:</strong> {evaluation.gap}</p>}
        {evaluation.missing_documents_or_evidence.length > 0 && <div><h3 className="font-semibold">Qué falta</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{evaluation.missing_documents_or_evidence.map((missing, index) => <li key={index}>{missing}</li>)}</ul></div>}
        <a href={`/api/files/documents/${latestReview.document}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Abrir el documento revisado (nueva pestaña)</a>
        {evaluation.suggested_text && <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Texto sugerido para revisar antes de usarlo</summary><p className="whitespace-pre-wrap text-sm leading-6">{evaluation.suggested_text}</p></details>}
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Datos de trazabilidad e historial</summary><p className="text-sm text-ink/70">{formatDateTime(latestReview.created_at)} · {latestReview.provider || "Proveedor no registrado"} · {latestReview.ai_model_used || "Modelo no registrado"} · Versión de instrucciones: {latestReview.prompt_version} · Revisor: {latestReview.created_by ?? "No registrado"}</p><Link href={`/projects/${project.id}/reviews?requirement=${item.requirement}`} className="inline-flex min-h-11 items-center text-sm text-signal underline">Ver las {support.reviews.length} revisiones de este requisito y todas sus citas</Link></details>
      </div> : <p className="text-sm text-ink/70">Todavía no hay una revisión de este requisito. {readyDocuments.length ? "Puedes solicitarla sobre uno de sus documentos." : "Aporta primero el documento y espera a que termine su procesamiento."}</p>}
      {project.can_edit && readyDocuments.length > 0 && <details className="mt-5 border-t border-ink/10 pt-3" open={!evaluation}><summary className="min-h-11 cursor-pointer py-3 font-semibold">{evaluation ? "Solicitar otra revisión" : "Revisar el documento disponible"}</summary><ActionForm action={runReviewAction} className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
        {contextFields}<input type="hidden" name="review_type" value="CUMPLIMIENTO_NORMATIVO" />
        <FormField label="Documento de este requisito"><select name="document" required defaultValue={readyDocuments[0].id}>{readyDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></FormField>
        <SubmitButton label="Revisar este requisito" pendingLabel="Solicitando revisión..." />
      </ActionForm></details>}
      {evaluation?.status === "NO_APLICA" && !item.is_not_applicable && (project.can_validate ? <ActionForm action={confirmNotApplicableAction} className="mt-5 space-y-3 border-t border-ink/10 pt-4">{contextFields}<h3 className="font-semibold">Confirmar no aplicabilidad</h3><p className="text-sm text-ink/70">Revisa el alcance y justifica tu decisión. La sugerencia de NORMAN requiere aprobación humana.</p><FormField label="Justificación de no aplicabilidad"><textarea name="justification" required /></FormField><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirmed" required className="h-5 w-5" />He revisado el alcance y confirmo esta decisión.</label><SubmitButton label="Aprobar no aplicabilidad" pendingLabel="Guardando decisión..." /></ActionForm> : <p className="mt-4 text-sm text-ink/70">Un responsable o auditor debe confirmar la no aplicabilidad y justificarla.</p>)}
      <div className="mt-5 flex flex-wrap gap-4">{project.can_edit && <Link href={href("documents")} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Aportar un documento corregido</Link>}<Link href={href("evidence")} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Continuar con la evidencia de implementación</Link></div>
    </SectionCard>}

    {step === "evidence" && <SectionCard title="Demostrar la implementación" description="Aporta registros u otros soportes de lo que realmente se ejecutó. Una persona autorizada debe revisarlos antes de validar la implementación.">
      {support.evidences.length ? <div className="divide-y divide-ink/10">{support.evidences.map((evidence) => <article key={evidence.id} className="space-y-3 py-5 first:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{evidence.title}</h3><StatusBadge value={evidence.status} /></div>
        <p className="whitespace-pre-wrap text-sm leading-6">{evidence.description || "Sin descripción adicional."}</p><p className="text-sm text-ink/70">Ocurrencia: {formatDate(evidence.occurred_on)} · Carga: {formatDateTime(evidence.uploaded_at)}</p>
        {evidence.file ? <a href={`/api/files/evidences/${evidence.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Abrir soporte (nueva pestaña)</a> : <p className="text-sm text-ink/70">No hay archivo adjunto. Comprueba la descripción y el contexto antes de decidir.</p>}
        {evidence.validation_notes && <p className="whitespace-pre-wrap text-sm"><strong>Notas de la decisión:</strong> {evidence.validation_notes}</p>}
        {evidence.validated_at && <p className="text-sm text-ink/70">Decisión: {formatDateTime(evidence.validated_at)} · Revisor: {evidence.validated_by ?? "No registrado"}</p>}
        {evidence.status === "RECHAZADA" && <p className="text-sm">Aporta una nueva evidencia corregida. El rechazo y el archivo original se conservan.</p>}
        {evidence.status === "CARGADA" && project.can_validate && <details><summary className="min-h-11 cursor-pointer py-3 font-semibold text-signal">Revisar y decidir sobre esta evidencia</summary><div className="grid gap-5 pt-3 lg:grid-cols-2">
          <ActionForm action={validateEvidenceAction} className="space-y-3"><input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="evidence_id" value={evidence.id} /><input type="hidden" name="transition" value="validate_evidence" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="h-5 w-5 shrink-0" />He revisado el soporte y su relación con el requisito.</label><FormField label="Notas de validación"><textarea name="validation_notes" /></FormField><SubmitButton label="Validar evidencia" pendingLabel="Validando..." /></ActionForm>
          <ActionForm action={validateEvidenceAction} className="space-y-3"><input type="hidden" name="return_path" value={returnPath} /><input type="hidden" name="evidence_id" value={evidence.id} /><input type="hidden" name="transition" value="reject_evidence" /><FormField label="Motivo del rechazo"><textarea name="validation_notes" required /></FormField><SubmitButton label="Rechazar evidencia" pendingLabel="Guardando decisión..." /></ActionForm>
        </div></details>}
      </article>)}</div> : <p className="mb-5 text-sm text-ink/70">Todavía no hay evidencia de implementación asociada a este requisito.</p>}
      {project.can_edit && <details className="mt-4 border-t border-ink/10 pt-3" open={!support.evidences.length}><summary className="min-h-11 cursor-pointer py-3 font-semibold">Añadir evidencia de implementación</summary><ActionForm action={createEvidenceAction} className="grid gap-4 md:grid-cols-2">
        {contextFields}<FormField label="Qué se ejecutó"><input name="title" required placeholder="Ejemplo: inspección del lote recibido" /></FormField><FormField label="Tipo de evidencia"><select name="evidence_type" defaultValue={evidenceTypes.includes(item.required_evidence_type) ? item.required_evidence_type : "OTRO"}>{evidenceTypes.map((type) => <option key={type} value={type}>{taskLabel(type)}</option>)}</select></FormField><FormField label="Fecha de ejecución (opcional)"><input type="date" name="occurred_on" /></FormField><FormField label="Archivo de soporte (opcional)"><input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png" /></FormField><div className="md:col-span-2"><FormField label="Descripción y contexto"><textarea name="description" placeholder="Indica lo realizado y cómo el soporte permite comprobarlo." /></FormField></div><div className="md:col-span-2"><SubmitButton label="Guardar evidencia para validación" pendingLabel="Guardando evidencia..." /></div>
      </ActionForm></details>}
      {!project.can_validate && <p className="mt-4 text-sm text-ink/70">La validación de las evidencias corresponde al responsable o auditor de la empresa.</p>}
      <p className="mt-5 text-sm leading-6">Estado del requisito: <strong>{requirementStatusHelp[item.status] ?? item.status}</strong> El cierre depende también de sus condiciones y acciones abiertas.</p>
    </SectionCard>}

    {plans.length > 0 && <aside className="rounded-xl border border-ink/15 bg-white p-4"><p className="font-semibold">Hay {plans.length} {plans.length === 1 ? "acción abierta" : "acciones abiertas"} asociadas a este requisito.</p><Link href={`/projects/${project.id}/action-plans?requirement=${item.requirement}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">Ver qué hay que corregir y las fechas de compromiso</Link></aside>}
  </div>;
}
