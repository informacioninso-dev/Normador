"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const secondary = [
  { href: "/", label: "Resumen de todas las empresas", staffOnly: false },
  { href: "/projects", label: "Todos los proyectos", staffOnly: false },
  { href: "/library", label: "Referencias normativas", staffOnly: false },
  { href: "/users", label: "Usuarios y accesos", staffOnly: true },
];
export function ShellNav({ isStaff = false, onNavigate }: { isStaff?: boolean; stacked?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const linkClass = (href: string) => `block min-h-11 rounded-xl px-4 py-3 text-sm font-semibold ${active(href) ? "bg-signal text-white" : "text-ink/70 hover:bg-sand"}`;
  return <nav aria-label="Navegación principal" className="grid gap-3">
    <Link href="/companies" onClick={onNavigate} aria-current={active("/companies") ? "page" : undefined} className={linkClass("/companies")}>Empresas cliente</Link>
    <p className="px-4 text-sm leading-6 text-ink/70">Elige la empresa y abre su proyecto para continuar el trabajo.</p>
    <details open={secondary.some((item) => active(item.href))} className="border-t border-ink/10 pt-2"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Consultas y administración</summary><div className="mt-2 grid gap-2">{secondary.filter((item) => !item.staffOnly || isStaff).map((item) => <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active(item.href) ? "page" : undefined} className={linkClass(item.href)}>{item.label}</Link>)}</div></details>
  </nav>;
}
