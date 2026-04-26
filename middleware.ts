// UNMAPPED - middleware that auto-detects the visitor's country from IP
// (using Vercel's free `x-vercel-ip-country` header) and seeds the URL's
// ?country= param if unset. The user can still override via the dropdown.

import { NextRequest, NextResponse } from "next/server";
import { isSupportedCountry } from "@/lib/config";

const HANDLED_PATHS = ["/", "/profile", "/opportunities", "/dashboard", "/admin/config", "/api-docs"];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (!HANDLED_PATHS.includes(pathname)) return NextResponse.next();
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
  matcher: ["/", "/profile", "/opportunities", "/dashboard", "/admin/config", "/api-docs"],
};
