"use server";

import { redirect } from "next/navigation";

import { apiDelete, apiFormMutation, apiJsonMutation, apiGet, ApiError } from "@/lib/api";

function formFailure(error: unknown) {
  return { error: error instanceof Error ? error.message : "No se pudo completar la solicitud. Reintenta.", fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined };
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function redirectWithMessage(
  returnPath: string,
  kind: "success" | "error",
  message: string,
): never {
  const [pathname, query = ""] = returnPath.split("?");
  const params = new URLSearchParams(query);
  params.delete("success");
  params.delete("error");
  params.set(kind, message);
  const suffix = params.toString();
  redirect(suffix ? `${pathname}?${suffix}` : pathname);
}

function ensureReturnPath(formData: FormData) {
  const path = textValue(formData, "return_path");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/";
}

export async function saveMembershipAction(formData: FormData) {
  const id = textValue(formData, "membership_id");
  try {
    await apiJsonMutation(`/api/company-memberships/${id ? `${id}/` : ""}`, id ? "PATCH" : "POST", {
      company: numberValue(formData, "company"),
      username: textValue(formData, "username"),
      role: textValue(formData, "role"),
      is_active: formData.get("is_active") !== "false",
    });
  } catch (error) {
    return formFailure(error);
  }
  redirectWithMessage("/companies", "success", "Acceso actualizado.");
}

export async function confirmNotApplicableAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const item = numberValue(formData, "checklist_item");
  try {
    if (!item) throw new Error("Selecciona el requisito.");
    await apiJsonMutation(`/api/checklist-items/${item}/confirm_not_applicable/`, "POST", {
      justification: textValue(formData, "justification"),
      confirmed: formData.get("confirmed") === "on",
    });
  } catch (error) {
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "No aplicabilidad aprobada. Los pendientes abiertos deben resolverse antes del cierre.");
}

export async function createCompanyAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);

  try {
    await apiJsonMutation("/api/companies/", "POST", {
      name: textValue(formData, "name"),
      ruc: textValue(formData, "ruc"),
      industry: textValue(formData, "industry"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la empresa.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Empresa creada.");
}

export async function createProjectAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const successReturnPath = textValue(formData, "success_return_path") || returnPath;
  const selectedCompanyId = numberValue(formData, "company");
  const companyName = textValue(formData, "company_name");
  const companyRuc = textValue(formData, "company_ruc");

  if (!selectedCompanyId && (!companyName || !companyRuc)) {
    return { error: "Selecciona una empresa o crea una rapida con nombre y RUC." };
  }

  try {
    let companyId = selectedCompanyId;

    if (!companyId) {
      const company = await apiJsonMutation<{ id: number }>("/api/companies/", "POST", {
        name: companyName,
        ruc: companyRuc,
        industry: textValue(formData, "company_industry"),
      });

      companyId = company.id;
    }

    await apiJsonMutation("/api/projects/", "POST", {
      company: companyId,
      standard: numberValue(formData, "standard"),
      name: textValue(formData, "name"),
      scope: textValue(formData, "scope"),
      status: textValue(formData, "status") || "PLANNING",
      start_date: textValue(formData, "start_date") || null,
      target_date: textValue(formData, "target_date") || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el proyecto.";
    return formFailure(error);
  }

  redirectWithMessage(successReturnPath, "success", "Proyecto creado y checklist generado.");
}

export async function uploadDocumentAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const payload = new FormData();

  const project = textValue(formData, "project");
  const requirement = textValue(formData, "requirement");
  const checklistItem = textValue(formData, "checklist_item");
  const title = textValue(formData, "title");
  const documentType = textValue(formData, "document_type");
  const autoReview = textValue(formData, "auto_review") === "1";
  const file = formData.get("file");

  payload.set("project", project);
  payload.set("auto_review", autoReview ? "true" : "false");
  payload.set("document_type", documentType);
  if (requirement) {
    payload.set("requirement", requirement);
  }
  if (checklistItem) {
    payload.set("checklist_item", checklistItem);
  }
  if (title) {
    payload.set("title", title);
  }
  if (file instanceof File && file.size > 0) {
    payload.set("file", file);
  }

  let document: { id: number; status: string } | null = null;
  try {
    document = await apiFormMutation<{ id: number; status: string }>(
      "/api/documents/",
      "POST",
      payload,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el documento.";
    return formFailure(error);
  }

  if (!document) {
    return { error: "No se pudo cargar el documento." };
  }

  redirectWithMessage(returnPath, "success", autoReview
    ? "Documento cargado. Consulta el procesamiento y la revision en Documentos y Revisiones."
    : "Documento cargado. Consulta el estado de procesamiento en Documentos.");
}

export async function reprocessDocumentAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  try {
    await apiJsonMutation(`/api/documents/${numberValue(formData, "document")}/reprocess/`, "POST", {});
  } catch (error) {
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Procesamiento solicitado. Consulta su estado en el documento.");
}

export async function runReviewAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const requirementId = numberValue(formData, "requirement");
  const payload: Record<string, unknown> = {
    document: numberValue(formData, "document"),
    review_type: textValue(formData, "review_type"),
  };
  if (requirementId) {
    payload.requirements = [requirementId];
  }

  try {
    await apiJsonMutation("/api/document-reviews/enqueue/", "POST", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la revision.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Revisión solicitada. Puedes consultar el estado y el resultado en Revisiones.");
}

export async function createActionPlanAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);

  try {
    await apiJsonMutation("/api/action-plans/", "POST", {
      project: numberValue(formData, "project"),
      finding: numberValue(formData, "finding"),
      requirement: numberValue(formData, "requirement"),
      checklist_item: numberValue(formData, "checklist_item"),
      title: textValue(formData, "title"),
      description: textValue(formData, "description"),
      recommended_action: textValue(formData, "recommended_action"),
      risk_level: textValue(formData, "risk_level") || "MEDIO",
      due_date: textValue(formData, "due_date") || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el plan.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Plan de accion creado.");
}

export async function transitionActionPlanAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const actionPlanId = numberValue(formData, "action_plan_id");
  const transition = textValue(formData, "transition");
  const completionNotes = textValue(formData, "completion_notes");

  if (!actionPlanId || !transition) {
    return { error: "Faltan datos para actualizar el plan." };
  }

  try {
    const path = `/api/action-plans/${actionPlanId}/${transition}/`;
    await apiJsonMutation(path, "POST", {
      completion_notes: completionNotes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el plan.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Plan de accion actualizado.");
}

export async function createImplementationActivityAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);

  try {
    await apiJsonMutation("/api/implementation-activities/", "POST", {
      project: numberValue(formData, "project"),
      action_plan: numberValue(formData, "action_plan"),
      requirement: numberValue(formData, "requirement"),
      checklist_item: numberValue(formData, "checklist_item"),
      activity_type: textValue(formData, "activity_type") || "SEGUIMIENTO",
      title: textValue(formData, "title"),
      notes: textValue(formData, "notes"),
      happened_on: textValue(formData, "happened_on") || null,
      next_follow_up_on: textValue(formData, "next_follow_up_on") || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar la actividad.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Actividad registrada.");
}

export async function createWorklogAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);

  try {
    const payload: Record<string, unknown> = {
      project: numberValue(formData, "project"),
      action_plan: numberValue(formData, "action_plan"),
      activity_type: textValue(formData, "activity_type") || "IMPLEMENTACION",
      title: textValue(formData, "title"),
      summary: textValue(formData, "summary"),
      deliverables: textValue(formData, "deliverables"),
    };

    for (const field of [
      "work_date",
      "start_time",
      "end_time",
      "logged_hours",
      "billable_hours",
    ]) {
      const value = textValue(formData, field);
      if (value) {
        payload[field] = value;
      }
    }

    const worklog = await apiJsonMutation<{ id: number }>("/api/worklogs/", "POST", payload);
    const supportPhoto = formData.get("support_photo");
    const supportFile = formData.get("support_file");
    const selectedSupport =
      supportPhoto instanceof File && supportPhoto.size > 0 ? supportPhoto : supportFile;
    if (selectedSupport instanceof File && selectedSupport.size > 0) {
      const supportPayload = new FormData();
      supportPayload.set("worklog", String(worklog.id));
      supportPayload.set("file", selectedSupport);
      const supportTitle = textValue(formData, "support_title");
      const supportNotes = textValue(formData, "support_notes");
      if (supportTitle) {
        supportPayload.set("title", supportTitle);
      }
      if (supportNotes) {
        supportPayload.set("notes", supportNotes);
      }
      await apiFormMutation("/api/worklog-evidences/", "POST", supportPayload);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar la jornada.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Jornada registrada.");
}

export async function createWorklogEvidenceAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const payload = new FormData();

  for (const field of ["worklog", "title", "notes"]) {
    const value = textValue(formData, field);
    if (value) {
      payload.set(field, value);
    }
  }

  const photo = formData.get("photo");
  const file = formData.get("file");
  const selectedFile = photo instanceof File && photo.size > 0 ? photo : file;
  if (selectedFile instanceof File && selectedFile.size > 0) {
    payload.set("file", selectedFile);
  }

  try {
    await apiFormMutation("/api/worklog-evidences/", "POST", payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo subir el soporte.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Soporte agregado a la jornada.");
}

export async function regenerateChecklistFromLibraryAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const projectId = numberValue(formData, "project_id");

  if (!projectId) {
    return { error: "Falta el proyecto para actualizar el checklist." };
  }

  try {
    const result = await apiJsonMutation<{
      created_items: number;
      created_requirements: number;
      reference_documents: number;
      extracted_clauses: number;
    }>(`/api/projects/${projectId}/regenerate_checklist/`, "POST", {
      use_library: true,
    });
    redirectWithMessage(
      returnPath,
      "success",
      `Checklist actualizado: ${result.created_requirements} requisitos nuevos, ${result.created_items} items nuevos.`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el checklist.";
    return formFailure(error);
  }
}

export async function reviewWorklogAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const worklogId = numberValue(formData, "worklog_id");
  const transition = textValue(formData, "transition");

  if (!worklogId || !transition) {
    return { error: "Faltan datos para revisar la jornada." };
  }

  try {
    const payload: Record<string, unknown> = {
      review_notes: textValue(formData, "review_notes"),
    };
    const approvedHours = textValue(formData, "approved_hours");
    if (transition === "approve" && approvedHours) {
      payload.approved_hours = approvedHours;
    }

    await apiJsonMutation(`/api/worklogs/${worklogId}/${transition}/`, "POST", payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo revisar la jornada.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Jornada revisada.");
}

export async function createEvidenceAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const payload = new FormData();

  const fields = [
    "project",
    "action_plan",
    "finding",
    "requirement",
    "checklist_item",
    "document",
    "title",
    "description",
    "evidence_type",
    "occurred_on",
  ];

  for (const field of fields) {
    const value = textValue(formData, field);
    if (value) {
      payload.set(field, value);
    }
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    payload.set("file", file);
  }

  try {
    await apiFormMutation("/api/evidences/", "POST", payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar la evidencia.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Evidencia registrada.");
}

export async function deleteCompanyAction(formData: FormData) {
  const id = textValue(formData, "company_id");
  const returnPath = ensureReturnPath(formData);
  try {
    await apiDelete(`/api/companies/${id}/`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar la empresa.";
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Empresa archivada; sus datos se conservan.");
}

export async function deleteProjectAction(formData: FormData) {
  const id = textValue(formData, "project_id");
  const returnPath = ensureReturnPath(formData);
  try {
    await apiDelete(`/api/projects/${id}/`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el proyecto.";
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Proyecto archivado; sus datos se conservan.");
}

export async function createUserAction(formData: FormData) {
  const returnPath = "/users";
  try {
    await apiJsonMutation("/api/users/", "POST", {
      username: textValue(formData, "username"),
      password: textValue(formData, "password"),
      email: textValue(formData, "email"),
      first_name: textValue(formData, "first_name"),
      last_name: textValue(formData, "last_name"),
      is_staff: formData.get("is_staff") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el usuario.";
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Usuario creado.");
}

export async function updateUserAction(formData: FormData) {
  const id = textValue(formData, "user_id");
  const returnPath = "/users";
  try {
    const payload: Record<string, unknown> = {
      email: textValue(formData, "email"),
      first_name: textValue(formData, "first_name"),
      last_name: textValue(formData, "last_name"),
      is_staff: formData.get("is_staff") === "on",
      is_active: formData.get("is_active") === "on",
    };
    const password = textValue(formData, "password");
    if (password) payload.password = password;
    await apiJsonMutation(`/api/users/${id}/`, "PATCH", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el usuario.";
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Usuario actualizado.");
}

export async function deleteUserAction(formData: FormData) {
  const id = textValue(formData, "user_id");
  const returnPath = "/users";
  try {
    await apiDelete(`/api/users/${id}/`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el usuario.";
    return formFailure(error);
  }
  redirectWithMessage(returnPath, "success", "Usuario desactivado; su historial se conserva.");
}

export async function validateEvidenceAction(formData: FormData) {
  const returnPath = ensureReturnPath(formData);
  const evidenceId = numberValue(formData, "evidence_id");
  const transition = textValue(formData, "transition");
  const validationNotes = textValue(formData, "validation_notes");

  if (transition === "validate_evidence" && formData.get("confirmed") !== "on") return { error: "Confirma que revisaste el soporte antes de validarlo." };
  if (transition === "reject_evidence" && !validationNotes) return { error: "Indica el motivo para que el implementador pueda corregir la evidencia.", fieldErrors: { validation_notes: "El motivo del rechazo es obligatorio." } };

  if (!evidenceId || !transition) {
    return { error: "Faltan datos para validar la evidencia." };
  }

  try {
    await apiJsonMutation(`/api/evidences/${evidenceId}/${transition}/`, "POST", {
      validation_notes: validationNotes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar la evidencia.";
    return formFailure(error);
  }

  redirectWithMessage(returnPath, "success", "Evidencia actualizada.");
}
