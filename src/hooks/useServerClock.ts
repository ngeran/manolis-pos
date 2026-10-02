"use client";

import { useEffect, useState } from "react";

/**
 * Server-clock time in ms, ticking every second.
 *
 * Captures the server/device clock offset whenever a poll response delivers a
 * fresh `serverTime`, so age timers stay correct regardless of the device clock.
 */
/* eslint-disable react-hooks/set-state-in-effect -- the offset must be captured
   at the moment a poll response lands; there is no subscribable event for it. */
export function useServerClock(
  serverTimeIso: string | null | undefined,
  intervalMs = 1000
): number {
  const [now, setNow] = useState(() => Date.now());
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    if (serverTimeIso) setOffsetMs(Date.now() - Date.parse(serverTimeIso));
  }, [serverTimeIso]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now - offsetMs;
}
