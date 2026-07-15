import { NextRequest, NextResponse } from "next/server";

/**
 * Catch-all proxy: /api/** → BACKEND_URL/api/**
 *
 * BACKEND_URL is a runtime Cloud Run env var — no baking at build time.
 * This avoids CORS entirely because the browser only ever talks to the
 * Next.js origin; the backend call is server-to-server.
 *
 * Hardening:
 * - Only an allowlist of request headers is forwarded (never Cookie).
 * - Authorization is stripped on public/auth paths, so a stale token in the
 *   browser can never leak to endpoints that don't need it.
 * - Only an allowlist of response headers is returned to the browser.
 */
const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8080";

/** Request headers we forward to the backend. Everything else is dropped. */
const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "accept-language",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
];

/** Response headers we pass back to the browser. Everything else is dropped. */
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  "cache-control",
];

/**
 * Backend paths that are unauthenticated by design. The client's
 * Authorization header is never forwarded here — a stale/invalid token
 * would only cause spurious 401s (or leak the token needlessly).
 */
const PUBLIC_PATH_PREFIXES = [
  "public/",
  "auth/login",
  "auth/verify-otp",
  "auth/select-org",
  "auth/forgot-password",
  "auth/reset-password",
  "invitations/",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function proxy(
  req: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = params.path.join("/");
  const targetUrl = `${BACKEND_URL}/api/${path}${req.nextUrl.search}`;
  const publicPath = isPublicPath(path);

  const forwardHeaders = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    if (publicPath && name === "authorization") continue;
    const value = req.headers.get(name);
    if (value !== null) {
      forwardHeaders.set(name, value);
    }
  }

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.arrayBuffer()
      : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch {
    return NextResponse.json(
      { message: "Cannot reach the backend server." },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) {
      responseHeaders.set(name, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function OPTIONS(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
