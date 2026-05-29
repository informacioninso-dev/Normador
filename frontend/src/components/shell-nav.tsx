"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseLinks = [
  { href: "/", label: "Dashboard", staffOnly: false },
  { href: "/companies", label: "Empresas", staffOnly: false },
  { href: "/projects", label: "Proyectos", staffOnly: false },
  { href: "/library", label: "Biblioteca", staffOnly: false },
  { href: "/users", label: "Usuarios", staffOnly: true },
];

export function ShellNav({
  isStaff = false,
  stacked = false,
  onNavigate,
}: {
  isStaff?: boolean;
  stacked?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const links = baseLinks.filter((l) => !l.staffOnly || isStaff);

  return (
    <nav
      className={
        stacked
          ? "grid gap-2"
          : "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      }
    >
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={[
              "shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold transition",
              stacked ? "w-full" : "",
              active
                ? "bg-signal text-white shadow-[0_16px_32px_rgba(79,126,217,0.28)]"
                : "ui-pill text-ink/72 hover:bg-[#edf3ff] hover:text-ink",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
