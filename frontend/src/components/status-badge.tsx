const statusStyles: Record<string, string> = {
  BORRADOR: "bg-stone-100 text-stone-700",
  VIGENTE: "bg-emerald-100 text-emerald-800",
  OBSOLETO: "bg-amber-100 text-amber-800",
  ARCHIVADO: "bg-stone-200 text-stone-700",
  PLANNING: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-sky-100 text-sky-800",
  ON_HOLD: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-stone-200 text-stone-700",
  REGISTRADO: "bg-sky-100 text-sky-800",
  APROBADO: "bg-emerald-100 text-emerald-800",
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

const statusLabels: Record<string, string> = {
  BORRADOR: "Borrador",
  VIGENTE: "Vigente",
  OBSOLETO: "Obsoleto",
  ARCHIVADO: "Archivado",
  PLANNING: "Planificacion",
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
  REGISTRADO: "Registrado",
  APROBADO: "Aprobado",
  NO_INICIADO: "No iniciado",
  PENDIENTE_DOCUMENTAL: "Pendiente documental",
  EN_REVISION: "En revision",
  CUMPLE_PARCIAL: "Cumple parcial",
  OBSERVADO: "Observado",
  VALIDADO_DOCUMENTALMENTE: "Validado documental",
  IMPLEMENTADO: "Implementado",
  CERRADO: "Cerrado",
  CARGADO: "Cargado",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  FALLIDO: "Fallido",
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
  SUPERSEDIDO: "Reemplazado",
  VALIDADA: "Validada",
  RECHAZADA: "Rechazada",
  CARGADA: "Cargada",
  CUMPLE: "Cumple",
  NO_CUMPLE: "No cumple",
  NO_APLICA: "No aplica",
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
};

function humanize(value: string) {
  if (statusLabels[value]) {
    return statusLabels[value];
  }
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
        "inline-flex rounded-full border border-black/5 px-3 py-1 text-xs font-semibold tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        "whitespace-nowrap",
        statusStyles[value] ?? "bg-stone-200 text-stone-700",
        className,
      ].join(" ")}
    >
      {humanize(value)}
    </span>
  );
}
