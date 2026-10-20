"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NormanAvatar } from "@/components/norman-avatar";

type Advice = { text: string; title?: string; href?: string; label?: string; mood?: "ready" | "attention" };
export function NormanAssistant() {
  const path = usePathname();
  const query = useSearchParams();
  const project = path.match(/^\/projects\/(\d+)/)?.[1];
  const company = path.match(/^\/companies\/(\d+)/)?.[1];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const contextKey = `${path}?${query.toString()}`;
  useEffect(() => { controller.current?.abort(); setBusy(false); setAdvice(null); setError(""); }, [contextKey]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (open) panel.current?.focus();
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && open) { setOpen(false); button.current?.focus(); } }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  async function nextStep() {
    if (!project || busy) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/assistant/context?project=${project}${query.get("item") ? `&item=${encodeURIComponent(query.get("item")!)}` : ""}`, { signal: request.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No pude consultar el proyecto.");
      setAdvice(data);
    } catch (e) { if (!request.signal.aborted) setError(e instanceof Error ? e.message : "No pude consultar el proyecto."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  const help = path.includes("document-control") ? "Aquí preparas documentos y conservas sus versiones. Usa Word o PDF para descargar. El logo se configura en la empresa." : path.includes("checklist") ? "Cada requisito tiene cuatro pasos: qué se pide, documentación, revisión y evidencia. Abre el paso que necesitas." : path.includes("evidence") ? "Carga soporte de lo que realmente se ejecutó. Su validación corresponde al responsable o auditor." : path.includes("companies") ? "Elige una empresa cliente y después su proyecto. En la empresa también configuras equipo, logo y encabezados." : project ? "La matriz muestra el estado de cada requisito. Ábrelo para trabajar o descarga el informe Excel con todo el detalle." : "Empieza por Empresas cliente. Cada empresa reúne sus proyectos, equipo y encabezados de documentos.";
  return <div className="no-print fixed bottom-4 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <div id="norman-help" ref={panel} tabIndex={-1} role="region" aria-label="Asistente NORMAN" className="ui-surface max-h-[min(620px,calc(100dvh-120px))] w-[360px] max-w-full overflow-y-auto rounded-3xl border border-signal/25 p-5 shadow-xl focus:outline-none">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><NormanAvatar mood={busy ? "working" : advice?.mood || "ready"} className="h-11 w-11" /><div><h2 className="font-bold">NORMAN</h2><p className="text-xs text-ink/65">Guía del sistema</p></div></div><button type="button" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Cerrar asistente NORMAN" className="ui-pill min-h-11 min-w-11 rounded-xl">×</button></div>
      <p className="my-4 text-sm leading-6">{help}</p>
      <div className="space-y-2">
        {project && <><button type="button" disabled={busy} onClick={nextStep} className="flex min-h-11 w-full items-center rounded-xl bg-signal px-4 py-3 text-left text-sm font-semibold text-white disabled:opacity-60">{busy ? "Consultando el proyecto…" : "Ayúdame con el siguiente paso"}</button><Link onClick={() => setOpen(false)} href={`/projects/${project}`} className="ui-pill flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Ver matriz de avance</Link><a href={`/api/projects/${project}/report`} className="ui-pill flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Descargar informe Excel</a></>}
        {company && <Link onClick={() => setOpen(false)} href={`/companies/${company}?view=branding`} className="ui-pill flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Configurar logo y encabezado</Link>}
        {!project && !company && <Link onClick={() => setOpen(false)} href="/companies" className="ui-pill flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Elegir empresa cliente</Link>}
      </div>
      <div aria-live="polite" aria-busy={busy}>{error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}{advice && <div className="ui-muted mt-4 rounded-xl p-4">{advice.title && <h3 className="text-sm font-bold">{advice.title}</h3>}<p className="mt-2 text-sm leading-6">{advice.text}</p>{advice.href && <Link onClick={() => setOpen(false)} href={advice.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-signal underline">{advice.label}</Link>}</div>}</div>
    </div>}
    <button type="button" ref={button} aria-expanded={open} aria-controls="norman-help" aria-label={open ? "Cerrar asistente NORMAN" : "Abrir asistente NORMAN"} onClick={() => setOpen(!open)} className="group flex min-h-14 items-center gap-2 rounded-full border border-signal/30 bg-white py-2 pl-2 pr-5 font-bold text-ink shadow-lg transition-shadow hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"><span className="transition-transform group-hover:rotate-6 motion-reduce:transform-none"><NormanAvatar mood={open && busy ? "working" : open ? advice?.mood || "ready" : "ready"} className="h-11 w-11" /></span><span>NORMAN</span></button>
  </div>;
}
