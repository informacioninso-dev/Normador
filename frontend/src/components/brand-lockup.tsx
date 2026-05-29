import Image from "next/image";

type BrandLockupProps = {
  compact?: boolean;
  showParent?: boolean;
};

function BrandGlyph({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-10 w-10" : "h-12 w-12";
  const imageSize = compact ? 28 : 34;

  return (
    <div
      className={[
        "grid shrink-0 place-items-center rounded-[18px] border border-signal/15 bg-white text-ink shadow-[0_14px_30px_rgba(27,37,84,0.08)]",
        size,
      ].join(" ")}
    >
      <Image
        src="/brand/Logo.png"
        alt="Binnso"
        width={imageSize}
        height={imageSize}
        className="h-auto w-auto object-contain"
        priority
      />
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
