import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
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
          <div className="flex h-full flex-col rounded-[30px] border border-signal/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(238,243,255,0.92))] p-4 shadow-[0_24px_70px_rgba(27,37,84,0.1)] backdrop-blur">
            <Link
              href="/"
              className="rounded-[24px] border border-signal/12 bg-white/86 px-4 py-4"
            >
              <BrandLockup />
            </Link>

            <div className="mt-4 flex-1">
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
          <header className="mb-6 flex justify-end rounded-[28px] border border-signal/10 bg-white/74 px-5 py-4 shadow-[0_18px_50px_rgba(27,37,84,0.08)] backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/companies"
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Nueva empresa
              </Link>
              <Link
                href="/projects"
                className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,126,217,0.24)] transition hover:bg-signal/90"
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
