"use client";

import { useState } from "react";
import { uploadDocumentAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { StandardRequirement } from "@/lib/types";
import { supportTypes, taskLabel } from "@/lib/workflow";

export function DocumentIntakeForm({ projectId, requirements }: { projectId: number; requirements: StandardRequirement[] }) {
  const [storeOnly, setStoreOnly] = useState(requirements.length === 0);
  return <ActionForm action={uploadDocumentAction} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="project" value={projectId} /><input type="hidden" name="return_path" value={`/projects/${projectId}/documents`} /><input type="hidden" name="auto_review" value={storeOnly ? "0" : "1"} />
    {!requirements.length && <p className="text-sm text-ink/70 md:col-span-2">El proyecto todavía no tiene requisitos para comparar. Puedes guardar el documento y pedir al administrador que compruebe el catálogo de la norma.</p>}
    <FormField label="Archivo que quieres revisar"><input name="file" type="file" accept=".pdf,.docx,.xlsx,.txt" required aria-describedby="intake-file-help" /></FormField>
    <FormField label="Tipo de documento"><select name="document_type" defaultValue="PROCEDIMIENTO">{supportTypes.map((type) => <option key={type} value={type}>{taskLabel(type)}</option>)}</select></FormField>
    {!storeOnly && <div className="md:col-span-2"><FormField label="Requisito que quieres comprobar"><select name="requirement" required defaultValue=""><option value="" disabled>Selecciona una cláusula o requisito</option>{requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.clause} · {requirement.title}</option>)}</select></FormField><p className="mt-2 text-sm text-ink/70">NORMAN revisará este requisito. Después puedes revisar otros requisitos sobre el mismo documento desde el historial de revisiones.</p></div>}
    <FormField label="Título (opcional)"><input name="title" placeholder="Se usará el nombre del archivo si lo dejas vacío" /></FormField>
    <p id="intake-file-help" className="text-sm text-ink/70 md:col-span-2">Admite Word, Excel, PDF con texto y TXT. El archivo y los resultados quedarán guardados en este proyecto.</p>
    <details className="md:col-span-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Guardar el archivo para revisarlo más adelante</summary><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={storeOnly} disabled={!requirements.length} onChange={(event) => setStoreOnly(event.target.checked)} className="h-5 w-5" />Guardar sin asociar un requisito ni solicitar una revisión todavía.</label></details>
    <div className="md:col-span-2"><SubmitButton label={storeOnly ? "Guardar documento" : "Subir y revisar el requisito seleccionado"} pendingLabel="Enviando documento..." /></div>
  </ActionForm>;
}
