"use client";

export function PrintButton({ label = "Imprimir informe" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-sand transition hover:bg-ink/90"
    >
      {label}
    </button>
  );
}
