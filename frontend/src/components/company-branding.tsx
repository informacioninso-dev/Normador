"use client";

import { useEffect, useState } from "react";
import { saveCompanyBrandingAction } from "@/app/actions";
import { Company } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";
import { ActionForm } from "@/components/action-form";

export function CompanyBranding({ company, canManage }: { company: Company; canManage: boolean }) {
  const [header, setHeader] = useState(company.document_header || {});
  const [preview, setPreview] = useState("");
  const [remove, setRemove] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const logo = !remove && (preview || (company.has_logo ? `/api/files/companies/${company.id}?v=${encodeURIComponent(company.updated_at)}` : ""));
  return <section className="ui-surface rounded-3xl p-5 sm:p-6">
    <h2 className="text-xl font-bold">Logo y encabezado de archivos</h2>
    <p className="mt-2 text-sm text-ink/70">Se aplican a nuevos documentos, nuevas versiones e informes. Cada versión conserva su encabezado original.</p>
    <div className="my-5 rounded-xl border border-ink/15 bg-white p-5 text-slate-800" aria-label="Vista previa del encabezado">
      <div className="flex items-center gap-5 border-b border-slate-300 pb-4">
        {logo ? /* Private company image is served through the authenticated proxy. */ <img src={logo} alt={`Logo de ${company.name}`} className="h-16 w-28 object-contain" /> : <span className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-500">Sin logo</span>}
        <div className="min-w-0"><p className="break-words font-bold">{header.title || company.name}</p><p className="break-words text-sm">{header.subtitle}</p><p className="mt-1 text-xs text-slate-500">Código · Versión</p></div>
      </div><p className="py-5 text-sm text-slate-500">Contenido del documento</p><p className="break-words border-t pt-2 text-xs text-slate-500">{header.footer || "Pie de página"} · Página 1</p>
    </div>
    {canManage ? <ActionForm action={saveCompanyBrandingAction} className="space-y-4">
      <input type="hidden" name="company" value={company.id} />
      <label className="block text-sm font-semibold">Logo (PNG o JPG, máximo 2 MB)<input type="file" name="logo" accept="image/png,image/jpeg" className="ui-input mt-2 block min-h-11 w-full" disabled={remove} onChange={(e) => setPreview(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : "")} /></label>
      {company.has_logo && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="remove_logo" checked={remove} onChange={(e) => setRemove(e.target.checked)} />Quitar logo en las nuevas versiones</label>}
      {([{ key: "title", label: "Título del encabezado", max: 120 }, { key: "subtitle", label: "Subtítulo", max: 140 }, { key: "footer", label: "Pie de página", max: 180 }] as const).map(({ key, label, max }) => <label key={key} className="block text-sm font-semibold">{label}<input name={key} maxLength={max} value={header[key] || ""} placeholder={key === "title" ? company.name : "Opcional"} onChange={(e) => setHeader({ ...header, [key]: e.target.value })} className="ui-input mt-2 min-h-11 w-full" /></label>)}
      <SubmitButton pendingLabel="Guardando…" label="Guardar logo y encabezado" />
    </ActionForm> : <p className="text-sm text-ink/70">El responsable de esta empresa configura el logo y el encabezado.</p>}
  </section>;
}
