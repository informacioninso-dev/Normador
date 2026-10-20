import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api";

export async function GET(_request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  if (!/^[1-9]\d*$/.test(projectId)) return NextResponse.json({ detail: "Proyecto inválido." }, { status: 400 });
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/export_report/`, { headers: await getAuthHeaders(), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ detail: "No se pudo descargar el informe." }, { status: response.status });
    return new Response(response.body, { headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": response.headers.get("Content-Disposition") ?? "attachment",
      "Cache-Control": "private, no-store",
    } });
  } catch { return NextResponse.json({ detail: "Servidor local no disponible." }, { status: 503 }); }
}
