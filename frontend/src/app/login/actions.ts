"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function loginAction(formData: FormData) {
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const rawPassword = formData.get("password") as string | null;

  if (!username || !rawPassword) {
    return { error: "Usuario y contraseña son obligatorios.", fieldErrors: { username: !username ? "Escribe tu usuario." : "", password: !rawPassword ? "Escribe tu contraseña." : "" } };
  }

  let data: { access: string; refresh: string; user: { username: string } };

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: rawPassword }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const detail =
        typeof payload.detail === "string"
          ? payload.detail
          : typeof payload.non_field_errors === "object" && Array.isArray(payload.non_field_errors)
            ? payload.non_field_errors[0]
            : "Credenciales invalidas.";
      return { error: String(detail) };
    }

    data = await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    return { error: "No se pudo conectar con el servidor. Conservamos los datos para que puedas reintentar." };
  }

  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, data.access, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24,
  });
  store.set(REFRESH_TOKEN_COOKIE, data.refresh, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/companies");
}

export async function logoutAction() {
  const store = await cookies();
  const refresh = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refresh) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) throw new Error("No se pudo revocar la sesion.");
    } catch {
      redirect("/login?error=" + encodeURIComponent("No se pudo cerrar la sesion en el servidor. Reintenta cuando vuelva la conexion."));
    }
  }
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  redirect("/login");
}
