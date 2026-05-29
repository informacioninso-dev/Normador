import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { MobileShellMenu } from "@/components/mobile-shell-menu";
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
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col gap-4 px-3 py-3 sm:px-4 md:px-6 md:py-6 lg:flex-row lg:gap-6">
        <MobileShellMenu user={user} />

        <aside className="no-print sticky top-2 z-30 hidden lg:block lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[300px] lg:flex-none">
          <div className="ui-surface flex h-full flex-col rounded-[24px] p-3 backdrop-blur lg:rounded-[30px] lg:p-4">
            <Link
              href="/"
              className="ui-muted rounded-[20px] px-3 py-3 lg:rounded-[24px] lg:px-4 lg:py-4"
            >
              <BrandLockup compact />
            </Link>

            <div className="mt-3 flex-1 lg:mt-4">
              <ShellNav isStaff={user?.is_staff ?? false} />
            </div>

            {user && (
              <div className="ui-muted mt-3 rounded-[18px] p-3 lg:mt-4 lg:rounded-[20px]">
                <UserMenu username={user.username} isStaff={user.is_staff} />
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print ui-surface mb-4 hidden rounded-[22px] px-3 py-3 backdrop-blur md:mb-6 md:rounded-[28px] md:px-5 md:py-4 lg:block">
            <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
              <Link
                href="/companies"
                className="ui-pill rounded-full px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-[#edf3ff] md:py-2"
              >
                Nueva empresa
              </Link>
              <Link
                href="/projects?view=nuevo"
                className="rounded-full bg-signal px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,126,217,0.24)] transition hover:bg-signal/90 md:py-2"
              >
                Nuevo proyecto
              </Link>
            </div>
          </header>
          <main className="pb-8 print-area">{children}</main>
        </div>
      </div>
    </div>
  );
}
