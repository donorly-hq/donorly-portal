"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Its main job is recovering from stale-build chunk
 * errors: after a deploy, an open tab may try to load JS chunks that no
 * longer exist, which crashes with ChunkLoadError. One automatic reload
 * fetches the new build and fixes it; the guard prevents reload loops.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleChunk = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(
    `${error?.name ?? ""} ${error?.message ?? ""}`,
  );

  useEffect(() => {
    if (!isStaleChunk) return;
    const lastReload = Number(sessionStorage.getItem("donorly-chunk-reload") ?? 0);
    if (Date.now() - lastReload > 30_000) {
      sessionStorage.setItem("donorly-chunk-reload", String(Date.now()));
      window.location.reload();
    }
  }, [isStaleChunk]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#faf6ec" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 28, fontWeight: 700, color: "#0a4f3f", margin: 0 }}>Donorly</p>
          <p style={{ color: "#1c2b26", margin: 0 }}>
            {isStaleChunk
              ? "A new version of Donorly is available. Refreshing…"
              : "Something went wrong. Please try again."}
          </p>
          <button
            onClick={() => (isStaleChunk ? window.location.reload() : reset())}
            style={{
              backgroundColor: "#0a4f3f",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isStaleChunk ? "Refresh now" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  );
}
