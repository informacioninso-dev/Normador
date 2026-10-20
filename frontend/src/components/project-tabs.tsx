"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";

const projectTabs = [
  { href: "", label: "Matriz de avance", group: "work" },
  { href: "/checklist", label: "Requisitos", group: "work" },
  { href: "/action-plans", label: "Acciones correctivas", group: "work" },
  { href: "/evidence", label: "Evidencias y validación", group: "work" },
  { href: "/report", label: "Informe de avance", group: "work" },
  { href: "/documents", label: "Archivo de documentos", group: "tools" },
  { href: "/reviews", label: "Historial de revisiones", group: "tools" },
  { href: "/document-control", label: "Documentos controlados", group: "tools" },
  { href: "/daily-log", label: "Bitácora de trabajo", group: "tools" },
  { href: "/tracking", label: "Seguimiento de actividades", group: "tools" },
];

export function ProjectTabs({ projectId }: { projectId: number }) {
  const pathname = usePathname();
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const panelId = useId();
  const basePath = `/projects/${projectId}`;
  const isActive = (suffix: string) =>
    pathname === `${basePath}${suffix}` ||
    (suffix !== "" && pathname.startsWith(`${basePath}${suffix}/`));
  const currentSection = projectTabs.find((tab) => isActive(tab.href));

  useEffect(() => {
    if (disclosureRef.current) disclosureRef.current.open = false;
  }, [pathname]);

  return (
    <nav aria-label="Secciones del proyecto" className="pb-3">
      <details
        ref={disclosureRef}
        className="group"
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.currentTarget.open) {
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-controls={panelId}
          className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3 hover:bg-[#edf3ff] [&::-webkit-details-marker]:hidden"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-ink/70">Ir a otra tarea del proyecto</span>
            <span className="font-semibold text-ink">{currentSection?.label ?? "Seleccionar sección"}</span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0 text-ink/70 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div id={panelId} className="space-y-4 pt-3">
          {["work", "tools"].map((group) => <div key={group}>
            <p className="mb-2 text-sm font-semibold text-ink/70">{group === "work" ? "Trabajo del proyecto" : "Herramientas e historial"}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{projectTabs.filter((tab) => tab.group === group).map((tab) => {
            const href = `${basePath}${tab.href}`;
            const active = isActive(tab.href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (disclosureRef.current) {
                    disclosureRef.current.open = false;
                    disclosureRef.current.querySelector("summary")?.focus();
                  }
                }}
                className={[
                  "inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "ui-pill-active"
                    : "ui-pill text-ink/70 hover:bg-[#edf3ff] hover:text-ink",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}</div></div>)}
        </div>
      </details>
    </nav>
  );
}
