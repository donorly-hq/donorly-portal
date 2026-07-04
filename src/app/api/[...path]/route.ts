import { NextRequest, NextResponse } from "next/server";

/**
 * Catch-all proxy: /api/** → BACKEND_URL/api/**
 *
 * BACKEND_URL is a runtime Cloud Run env var — no baking at build time.
 * This avoids CORS entirely because the browser only ever talks to the
 * Next.js origin; the backend call is server-to-server.
 */
const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8080";

async function proxy(
  req: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = params.path.join("/");
  const targetUrl = `${BACKEND_URL}/api/${path}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    // Strip browser-specific headers — this is a server-to-server call
    // so Origin/Referer/Host must not be forwarded (they'd trigger CORS rejection)
    const skip = ["host", "connection", "transfer-encoding", "origin", "referer"];
    if (!skip.includes(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

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
  upstream.headers.forEach((value, key) => {
    if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

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
