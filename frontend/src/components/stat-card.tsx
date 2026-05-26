import type { ReactNode } from "react";

export function StatCard({
  eyebrow,
  title,
  value,
  detail,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  value: ReactNode;
  detail?: string;
  tone?: "default" | "accent" | "ink";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-signal text-white"
      : tone === "ink"
        ? "bg-ink text-sand"
        : "bg-white/85 text-ink";

  return (
    <article
      className={[
        "rounded-[24px] border border-black/8 p-4 shadow-[0_16px_40px_rgba(14,20,32,0.07)]",
        toneClass,
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
        {eyebrow}
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium opacity-80">{title}</h3>
          <p className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {value}
          </p>
        </div>
      </div>
      {detail ? <p className="mt-3 text-sm leading-6 opacity-80">{detail}</p> : null}
    </article>
  );
}
