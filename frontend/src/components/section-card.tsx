import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/8 bg-white/84 p-5 shadow-[0_18px_50px_rgba(14,20,32,0.07)] backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <h2
            className="text-xl font-bold text-ink md:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-ink/68">{description}</p>
          ) : null}
        </div>
        {action ? <div className="md:min-w-[240px]">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
