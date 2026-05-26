import Link from "next/link";

import { ShellNav } from "@/components/shell-nav";
import { UserMenu } from "@/components/user-menu";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function getCurrentUser() {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/auth/me/`, {
      cache: "no-store",
      headers: { Accept: "application/json", ...headers },
    });
    if (!response.ok) return null;
    return (await response.json()) as { username: string; is_staff: boolean };
  } catch {
    return null;
  }
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-app-texture">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col gap-6 px-4 py-4 md:px-6 md:py-6 lg:flex-row">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[300px] lg:flex-none">
          <div className="flex h-full flex-col rounded-[30px] border border-black/8 bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(247,242,233,0.86))] p-4 shadow-[0_24px_70px_rgba(14,20,32,0.1)] backdrop-blur">
            <Link href="/" className="rounded-[24px] bg-ink px-5 py-4 text-sand">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sand/70">
                Normador
              </p>
              <h1
                className="mt-2 text-3xl font-bold leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Opera cumplimiento.
              </h1>
              <p className="mt-2 text-sm leading-6 text-sand/75">
                Empresa, proyecto, documento, revision y cierre.
              </p>
            </Link>

            <div className="mt-4 flex-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
                Ir a
              </p>
              <ShellNav isStaff={user?.is_staff ?? false} />
            </div>

            {user && (
              <div className="mt-4 rounded-[20px] border border-black/8 bg-white/70 p-3">
                <UserMenu username={user.username} isStaff={user.is_staff} />
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-black/8 bg-white/74 px-5 py-4 shadow-[0_18px_50px_rgba(14,20,32,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">
                Workspace local
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/70">
                Norma, checklist, revision y evidencia en un solo flujo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/companies"
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Nueva empresa
              </Link>
              <Link
                href="/projects"
                className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(198,95,43,0.24)] transition hover:bg-signal/90"
              >
                Nuevo proyecto
              </Link>
            </div>
          </header>
          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
