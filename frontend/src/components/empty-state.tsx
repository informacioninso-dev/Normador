export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="ui-muted rounded-[24px] border-dashed px-5 py-8 text-center">
      <h3
        className="text-lg font-bold text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/70">
        {description}
      </p>
    </div>
  );
}
