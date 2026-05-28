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

export function ShellNav({ isStaff = false }: { isStaff?: boolean }) {
  const pathname = usePathname();
  const links = baseLinks.filter((l) => !l.staffOnly || isStaff);

  return (
    <nav className="flex flex-col gap-2">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              active
                ? "bg-signal text-white shadow-[0_16px_32px_rgba(79,126,217,0.28)]"
                : "bg-white/70 text-ink hover:bg-white",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
