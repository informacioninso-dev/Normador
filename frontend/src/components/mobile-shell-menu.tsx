"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLockup } from "@/components/brand-lockup";
import { ShellNav } from "@/components/shell-nav";
import { UserMenu } from "@/components/user-menu";

type MobileShellMenuProps = {
  user: { username: string; is_staff: boolean } | null;
};

export function MobileShellMenu({ user }: MobileShellMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="no-print sticky top-2 z-40 lg:hidden">
      <div className="ui-surface rounded-[24px] p-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3 rounded-[20px] px-2 py-2">
          <Link href="/" className="min-w-0" onClick={closeMenu}>
            <BrandLockup compact />
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-shell-menu"
            onClick={() => setOpen((current) => !current)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-ink text-sand shadow-[0_14px_28px_rgba(27,37,84,0.18)]"
          >
            <span className="sr-only">{open ? "Cerrar menu" : "Abrir menu"}</span>
            <span className="flex flex-col gap-1.5">
              <span
                className={[
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  open ? "translate-y-2 rotate-45" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  open ? "opacity-0" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  open ? "-translate-y-2 -rotate-45" : "",
                ].join(" ")}
              />
            </span>
          </button>
        </div>

        {open ? (
          <div id="mobile-shell-menu" className="border-t border-signal/12 px-2 pb-2 pt-3">
            <ShellNav
              isStaff={user?.is_staff ?? false}
              stacked
              onNavigate={closeMenu}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/companies"
                onClick={closeMenu}
                className="ui-pill rounded-full px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-[#edf3ff]"
              >
                Nueva empresa
              </Link>
              <Link
                href="/projects?view=nuevo"
                onClick={closeMenu}
                className="rounded-full bg-signal px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,126,217,0.24)] transition hover:bg-signal/90"
              >
                Nuevo proyecto
              </Link>
            </div>
            {user && (
              <div className="ui-muted mt-3 rounded-[18px] p-3">
                <UserMenu username={user.username} isStaff={user.is_staff} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
