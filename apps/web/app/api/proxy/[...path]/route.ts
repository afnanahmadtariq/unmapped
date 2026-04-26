// Same-origin reverse proxy to the NestJS API.
//
// Why this exists:
//   * The browser never knows the upstream API URL, so we don't bake
//     `NEXT_PUBLIC_API_URL` into the client bundle. Changing the API
//     hostname only requires updating an env var on Vercel — no rebuild.
//   * Same-origin requests sidestep CORS entirely.
//   * Cookies set by the API are forwarded transparently because the
//     browser sees them as same-origin Set-Cookie headers.
//
// All HTTP methods are accepted; the upstream URL is built from
// `[...path]` plus the query string. Body, headers, status, set-cookie
// are streamed through. Hop-by-hop headers (host, connection,
// content-length, transfer-encoding, content-encoding) are stripped.

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveUpstream(): string {
  const raw = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "")
    .replace(/\/$/, "")
    .trim();
  if (!raw) return "http://localhost:4000";
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "accept-encoding",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-real-ip",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "content-length",
]);

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const segments = (path ?? []).join("/");
  const search = request.nextUrl.search ?? "";
  const upstreamBase = resolveUpstream();
  const url = `${upstreamBase}/${segments}${search}`;

  const upstreamHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  });

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "manual",
    cache: "no-store",
  };

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  if (hasBody && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return Response.json(
      {
        error: "Upstream API unreachable",
        message,
        upstream: url,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.append(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
  handle as HEAD,
};
