import { NextRequest, NextResponse } from "next/server";

import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ detail: "Payload invalido." }, { status: 400 });
  }

  const response = await fetch(`${getApiBaseUrl()}/api/worklogs/assistant-create/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
