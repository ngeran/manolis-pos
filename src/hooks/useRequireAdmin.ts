"use client";

import { useEffect, useState } from "react";

/** "loading" until the session role resolves, then allowed/denied. */
export function useRequireAdmin(): "loading" | "allowed" | "denied" {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setState(s?.user?.role === "admin" ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
