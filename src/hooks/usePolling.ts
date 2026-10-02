"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  /** True when the last fetch failed and data may be outdated. */
  isStale: boolean;
  lastUpdated: Date | null;
  /** Immediate refetch — call after a mutation to reconcile. */
  refresh: () => void;
}

/**
 * Fetch-and-poll hook: setTimeout chain (no overlapping requests), pauses
 * while the tab is hidden, backs off on errors keeping the last data, and
 * redirects to login on 401 (session expired mid-service).
 */
export function usePolling<T>(
  url: string,
  options?: { intervalMs?: number; enabled?: boolean }
): UsePollingResult<T> {
  const { intervalMs = 5000, enabled = true } = options ?? {};
  const router = useRouter();

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const backoff = useRef(1);
  const hidden = useRef(false);

  const fetchNow = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const res = await fetch(url, {
        signal: abort.current.signal,
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`
        );
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
      setIsStale(false);
      setLastUpdated(new Date());
      backoff.current = 1;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Network error");
      setIsStale(true);
      backoff.current = Math.min(backoff.current * 2, 12);
    } finally {
      inFlight.current = false;
    }
  }, [router, url]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      timer.current = setTimeout(async () => {
        if (cancelled) return;
        if (!hidden.current) await fetchNow();
        schedule();
      }, intervalMs * backoff.current);
    };

    void fetchNow().then(schedule);

    const onVisibility = () => {
      hidden.current = document.hidden;
      if (!document.hidden && !cancelled) void fetchNow();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, enabled, intervalMs, fetchNow]);

  const refresh = useCallback(() => {
    void fetchNow();
  }, [fetchNow]);

  return { data, error, isStale, lastUpdated, refresh };
}
