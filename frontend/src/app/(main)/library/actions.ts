"use server";

import { redirect } from "next/navigation";

import { apiFormMutation, apiJsonMutation } from "@/lib/api";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithFlash(kind: "success" | "error", message: string) {
  const params = new URLSearchParams();
  params.set(kind, encodeURIComponent(message));
  redirect(`/library?${params.toString()}`);
}

export async function uploadReferenceDocumentAction(formData: FormData) {
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    redirectWithFlash("error", "Debes seleccionar un archivo.");
    return;
  }

  const payload = new FormData();
  payload.set("is_reference", "true");
  payload.set("file", file);

  const title = textValue(formData, "title");
  if (title) payload.set("title", title);

  const documentType = textValue(formData, "document_type");
  if (documentType) payload.set("document_type", documentType);

  const libraryKind = textValue(formData, "library_kind");
  if (libraryKind) payload.set("library_kind", libraryKind);

  for (const field of [
    "library_standard",
    "library_company",
    "library_project",
    "process_area",
  ]) {
    const value = textValue(formData, field);
    if (value) payload.set(field, value);
  }

  for (const usage of formData.getAll("library_usages")) {
    if (typeof usage === "string" && usage.trim()) {
      payload.append("library_usages", usage.trim());
    }
  }

  try {
    await apiFormMutation("/api/documents/", "POST", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir el documento.";
    redirectWithFlash("error", message);
    return;
  }

  redirectWithFlash("success", "Documento agregado a la biblioteca.");
}

export async function deleteReferenceDocumentAction(formData: FormData) {
  const id = textValue(formData, "document_id");
  if (!id) {
    redirectWithFlash("error", "ID de documento no especificado.");
    return;
  }

  try {
    const { getAuthHeaders } = await import("@/lib/auth");
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}/`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el documento.";
    redirectWithFlash("error", message);
    return;
  }

  redirectWithFlash("success", "Documento eliminado de la biblioteca.");
}
