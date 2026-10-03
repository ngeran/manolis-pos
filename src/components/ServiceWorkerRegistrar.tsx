"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures (private mode, unsupported) are non-fatal.
      });
    }
  }, []);
  return null;
}
