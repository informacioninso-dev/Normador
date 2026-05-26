const statusStyles: Record<string, string> = {
  NO_INICIADO: "bg-stone-200 text-stone-700",
  PENDIENTE_DOCUMENTAL: "bg-amber-100 text-amber-800",
  EN_REVISION: "bg-sky-100 text-sky-800",
  CUMPLE_PARCIAL: "bg-orange-100 text-orange-800",
  OBSERVADO: "bg-rose-100 text-rose-800",
  VALIDADO_DOCUMENTALMENTE: "bg-emerald-100 text-emerald-800",
  IMPLEMENTADO: "bg-teal-100 text-teal-800",
  CERRADO: "bg-ink text-sand",
  CARGADO: "bg-stone-200 text-stone-700",
  PROCESANDO: "bg-sky-100 text-sky-800",
  LISTO: "bg-emerald-100 text-emerald-800",
  FALLIDO: "bg-rose-100 text-rose-800",
  ABIERTO: "bg-rose-100 text-rose-800",
  EN_PROGRESO: "bg-amber-100 text-amber-800",
  RESUELTO: "bg-teal-100 text-teal-800",
  SUPERSEDIDO: "bg-stone-200 text-stone-700",
  VALIDADA: "bg-emerald-100 text-emerald-800",
  RECHAZADA: "bg-rose-100 text-rose-800",
  CARGADA: "bg-sky-100 text-sky-800",
  CUMPLE: "bg-emerald-100 text-emerald-800",
  NO_CUMPLE: "bg-rose-100 text-rose-800",
  NO_APLICA: "bg-stone-200 text-stone-700",
  BAJO: "bg-emerald-100 text-emerald-800",
  MEDIO: "bg-amber-100 text-amber-800",
  ALTO: "bg-rose-100 text-rose-800",
};

function humanize(value: string) {
  return value
    .split("_")
    .join(" ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.08em]",
        statusStyles[value] ?? "bg-stone-200 text-stone-700",
        className,
      ].join(" ")}
    >
      {humanize(value)}
    </span>
  );
}
