import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api";

export async function GET(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  if (!["companies", "documents", "evidences", "worklog-evidences"].includes(resource) || !/^\d+$/.test(id)) {
    return NextResponse.json({ detail: "Archivo no encontrado." }, { status: 404 });
  }
  const response = await fetch(`${getApiBaseUrl()}/api/${resource}/${id}/download/`, {
    headers: await getAuthHeaders(), cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ detail: "No tienes acceso al archivo o ya no esta disponible." }, { status: response.status });
  return new NextResponse(response.body, { headers: {
    "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
    "Content-Disposition": response.headers.get("Content-Disposition") ?? "attachment",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
