// UNMAPPED - Next.js 16 proxy (formerly middleware). Two responsibilities:
//   1. Auto-detect the visitor's country from IP via Vercel/CF headers and
//      seed the URL's ?country= param if unset (covers user-facing pages).
//   2. Gate `/admin/*` routes behind the API admin session cookie. The
//      cookie itself is set by the API at /auth/login and verified there
//      with `AuthGuard`; here we only check existence to avoid round-tripping
//      every request.

import { NextRequest, NextResponse } from "next/server";
import { isSupportedCountry } from "@/lib/config";

const COUNTRY_PATHS = [
  "/",
  "/profile",
  "/opportunities",
  "/dashboard",
  "/admin/config",
  "/api-docs",
  "/account",
  "/account/login",
  "/account/signup",
];

const ADMIN_COOKIE = "unmapped_admin_session";

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("from", pathname + req.nextUrl.search);
      return NextResponse.redirect(url, 307);
    }
  }

  if (!COUNTRY_PATHS.includes(pathname)) return NextResponse.next();
  if (searchParams.get("country")) return NextResponse.next();

  const ipCountry =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  if (ipCountry && isSupportedCountry(ipCountry)) {
    const url = req.nextUrl.clone();
    url.searchParams.set("country", ipCountry.toUpperCase());
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/profile",
    "/opportunities",
    "/dashboard",
    "/admin/:path*",
    "/api-docs",
    "/account",
    "/account/:path*",
  ],
};
