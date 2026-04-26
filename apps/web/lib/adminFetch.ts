// Server-side helper: fetch from the API while forwarding the admin
// httpOnly cookie. Pages under /admin/* are server components, so we
// can't reuse the browser apiClient (no implicit cookie forwarding
// across origins). The Next.js proxy already redirects unauthenticated
// requests to /admin/login; here we just pass the cookie along so the
// API's AuthGuard accepts the request.

import { cookies, headers } from "next/headers";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

const ADMIN_COOKIE = "cartographer_admin_session";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE)?.value;
  const reqHeaders = await headers();
  const cookieHeader = session ? `${ADMIN_COOKIE}=${session}` : reqHeaders.get("cookie") ?? "";

  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      cookie: cookieHeader,
    },
  });
  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    const msg =
      (payload as any)?.message ||
      (payload as any)?.error ||
      `Request to ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return payload as T;
}
