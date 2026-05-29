"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const projectTabs = [
  { href: "", label: "Implementacion" },
  { href: "/daily-log", label: "Registro diario" },
];

export function ProjectTabs({ projectId }: { projectId: number }) {
  const pathname = usePathname();

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {projectTabs.map((tab) => {
        const href = `/projects/${projectId}${tab.href}`;
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={[
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
              active
                ? "ui-pill-active"
                : "ui-pill text-ink/70 hover:bg-[#edf3ff] hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
