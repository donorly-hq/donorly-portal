"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (production only). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure just means no offline caching — never block the app.
    });
  }, []);
  return null;
}
