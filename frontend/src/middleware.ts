import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

function expiresSoon(token: string | undefined) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp !== "number" || payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/brand/")) return NextResponse.next();
  const access = request.cookies.get("access_token")?.value;
  if (!expiresSoon(access)) return NextResponse.next();
  const refresh = request.cookies.get("refresh_token")?.value;
  if (refresh) {
    try {
      const renewed = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }), cache: "no-store",
      });
      if (renewed.ok) {
        const tokens = await renewed.json();
        request.cookies.set("access_token", tokens.access);
        const headers = new Headers(request.headers);
        headers.set("cookie", request.cookies.toString());
        const response = NextResponse.next({ request: { headers } });
        response.cookies.set("access_token", tokens.access, {
          httpOnly: true, sameSite: "lax", path: "/", secure: request.nextUrl.protocol === "https:", maxAge: 86400,
        });
        return response;
      }
    } catch {
      return NextResponse.json({ detail: "No se pudo renovar la sesion. Reintenta la solicitud." }, { status: 503 });
    }
  }
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
