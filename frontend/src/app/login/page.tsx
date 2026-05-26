import type { Metadata } from "next";

import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Ingresar — Normador" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const error =
    typeof query.error === "string" ? decodeURIComponent(query.error) : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-texture px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-[30px] border border-black/8 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(247,242,233,0.92))] p-8 shadow-[0_24px_70px_rgba(14,20,32,0.12)]">
          <div className="mb-8 rounded-[22px] bg-ink px-5 py-4 text-sand">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sand/70">
              Normador
            </p>
            <h1
              className="mt-2 text-3xl font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ingresar
            </h1>
            <p className="mt-1 text-sm text-sand/75">
              Implementacion normativa asistida por IA.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={loginAction} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Usuario
              </label>
              <input
                name="username"
                type="text"
                placeholder="admin"
                required
                autoComplete="username"
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Contraseña
              </label>
              <PasswordInput
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <SubmitButton
              label="Ingresar"
              pendingLabel="Verificando..."
              className="w-full"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
