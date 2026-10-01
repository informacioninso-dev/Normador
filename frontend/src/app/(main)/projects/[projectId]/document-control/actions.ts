"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiFormMutation, apiJsonMutation } from "@/lib/api";
import type { ControlledDocument } from "@/lib/types";

function text(form: FormData, field: string) {
  return String(form.get(field) ?? "").trim();
}

function positiveInteger(form: FormData, field: string) {
  const value = Number(text(form, field));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Identificador invalido.");
  return value;
}

export async function createControlledDocumentAction(form: FormData) {
  let controlled: ControlledDocument;
  const projectValue = Number(text(form, "project"));
  const returnPath = Number.isSafeInteger(projectValue) && projectValue > 0
    ? `/projects/${projectValue}/document-control` : "/projects";
  try {
    controlled = await apiJsonMutation<ControlledDocument>("/api/controlled-documents/", "POST", {
      project: positiveInteger(form, "project"),
      code: text(form, "code"),
      title: text(form, "title"),
      kind: text(form, "kind"),
      process_area: text(form, "process_area"),
      requirement: text(form, "requirement") ? positiveInteger(form, "requirement") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el documento.";
    redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(returnPath);
  redirect(`${returnPath}/${controlled.id}`);
}

export async function updateControlledDocumentAction(form: FormData): Promise<{ error?: string }> {
  try {
    const id = positiveInteger(form, "id");
    const expectedVersion = positiveInteger(form, "expected_version");
    const operation = text(form, "operation");
    let controlled: ControlledDocument;
    if (operation === "save") {
      controlled = await apiJsonMutation<ControlledDocument>(`/api/controlled-documents/${id}/new_revision/`, "POST", {
        expected_version: expectedVersion,
        change_summary: text(form, "change_summary"),
        content: JSON.parse(text(form, "content")),
      });
    } else if (operation === "upload") {
      const upload = form.get("file");
      if (!(upload instanceof File) || !upload.size) throw new Error("Selecciona el archivo corregido.");
      const payload = new FormData();
      payload.set("expected_version", String(expectedVersion));
      payload.set("change_summary", text(form, "change_summary"));
      payload.set("file", upload);
      controlled = await apiFormMutation<ControlledDocument>(`/api/controlled-documents/${id}/new_revision/`, "POST", payload);
    } else {
      controlled = await apiJsonMutation<ControlledDocument>(`/api/controlled-documents/${id}/transition/`, "POST", {
        expected_version: expectedVersion,
        action: operation,
        notes: text(form, "notes"),
        confirmed: form.get("confirmed") === "on",
      });
    }
    revalidatePath(`/projects/${controlled.project}/document-control`);
    revalidatePath(`/projects/${controlled.project}/document-control/${controlled.id}`);
    revalidatePath(`/projects/${controlled.project}/documents`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar el cambio." };
  }
}
