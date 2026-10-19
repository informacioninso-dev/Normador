import { NormanAvatar } from "@/components/norman-avatar";

type BrandLockupProps = {
  compact?: boolean;
  showParent?: boolean;
};

function BrandGlyph({ compact = false }: { compact?: boolean }) {
  return <NormanAvatar className={compact ? "h-10 w-10" : "h-12 w-12"} />;
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
          NORMAN AI
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
