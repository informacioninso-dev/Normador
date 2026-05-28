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
    <div className="flex gap-2 overflow-x-auto pb-1">
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
                ? "bg-ink text-sand"
                : "bg-white/75 text-ink/70 hover:bg-white hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
