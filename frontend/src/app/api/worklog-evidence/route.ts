import { NextRequest, NextResponse } from "next/server";

import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ detail: "Payload invalido." }, { status: 400 });
  }

  const response = await fetch(`${getApiBaseUrl()}/api/worklog-evidences/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(await getAuthHeaders()),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
