type BrandLockupProps = {
  compact?: boolean;
  showParent?: boolean;
};

function BrandGlyph({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-10 w-10" : "h-12 w-12";

  return (
    <div
      className={[
        "grid shrink-0 place-items-center rounded-[18px] border border-signal/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,242,255,0.96))] text-ink shadow-[0_14px_30px_rgba(27,37,84,0.08)]",
        size,
      ].join(" ")}
    >
      <svg viewBox="0 0 64 64" className={compact ? "h-8 w-8" : "h-9 w-9"} aria-hidden="true">
        <path
          d="M18 50c9.5 1 18.5-1.2 23-8.2 3.2-5 .8-10.8-5.8-12.9 6.5-1.5 10-6.8 8.5-12.1C41.5 8.4 31.6 6 21.7 8.6c-5.5 1.4-8.5 5.6-8.5 11.2 0 10-1 17.5-6.2 23.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31 18.5c6.7-4.1 14.5-3.7 20.8 1.1 2.4 1.8 5.5 2.8 9.2 2.8"
          fill="none"
          stroke="#4f7ed9"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M39.5 22.5c3.3 1.4 7 1.7 11 .8"
          fill="none"
          stroke="#90acf0"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function BrandLockup({
  compact = false,
  showParent = true,
}: BrandLockupProps) {
  return (
    <div className="flex items-center gap-3">
      <BrandGlyph compact={compact} />
      <div className="min-w-0">
        <p
          className={compact ? "text-xl font-bold leading-none text-ink" : "text-2xl font-bold leading-none text-ink"}
          style={{ fontFamily: "var(--font-display)" }}
        >
          Normador
        </p>
        {showParent ? (
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">
            by Binnso
          </p>
        ) : null}
      </div>
    </div>
  );
}
