import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";

export async function GET(request: NextRequest, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;
  const version = request.nextUrl.searchParams.get("version") ?? "";
  if (!/^[1-9]\d*$/.test(documentId) || !/^[1-9]\d*$/.test(version)) {
    return NextResponse.json({ detail: "Documento o version invalida." }, { status: 400 });
  }
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/controlled-documents/${documentId}/download/?version=${version}`,
      { headers: await getAuthHeaders(), cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json(await response.json().catch(() => ({ detail: "Descarga no disponible." })), {
        status: response.status,
      });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": response.headers.get("content-disposition") ?? "attachment",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ detail: "No se pudo conectar con el servidor local." }, { status: 503 });
  }
}
