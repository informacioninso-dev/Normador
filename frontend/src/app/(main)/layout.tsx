import { Suspense } from "react";
import { NormanAssistant } from "@/components/norman-assistant";
import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { MobileShellMenu } from "@/components/mobile-shell-menu";
import { ShellNav } from "@/components/shell-nav";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/api";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-app-texture">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4">Saltar al contenido principal</a>
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
          <main id="main-content" tabIndex={-1} className="pb-28 print-area">{children}</main>
        </div>
      </div>
      <Suspense fallback={null}><NormanAssistant /></Suspense>
    </div>
  );
}
