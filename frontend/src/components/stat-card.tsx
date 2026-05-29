import type { ReactNode } from "react";

export function StatCard({
  eyebrow,
  title,
  value,
  detail,
  tone = "default",
}: {
  eyebrow: string;
  title?: string;
  value: ReactNode;
  detail?: string;
  tone?: "default" | "accent" | "ink";
}) {
  const toneClass =
    tone === "accent"
      ? "border-signal/20 bg-signal text-white shadow-[0_18px_40px_rgba(79,126,217,0.22)]"
      : tone === "ink"
        ? "border-ink/10 bg-ink text-sand shadow-[0_18px_40px_rgba(27,37,84,0.2)]"
        : "ui-card text-ink";

  return (
    <article
      className={[
        "rounded-[22px] border p-4",
        toneClass,
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
        {eyebrow}
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          {title ? <h3 className="text-sm font-medium opacity-80">{title}</h3> : null}
          <p className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {value}
          </p>
        </div>
      </div>
      {detail ? <p className="mt-3 text-sm leading-6 opacity-80">{detail}</p> : null}
    </article>
  );
}
