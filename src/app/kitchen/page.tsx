"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { useServerClock } from "@/hooks/useServerClock";
import { TicketCard } from "@/components/kitchen/TicketCard";
import { VoidModal } from "@/components/kitchen/VoidModal";
import { cn } from "@/lib/utils";
import type { VoidReason } from "@/lib/db/schema";
import type { KitchenItem, KitchenPayload, KitchenTicket } from "@/lib/kitchen";
import {
  playChime,
  requestNotifyPermission,
  unlockAudio,
  vibrate,
  notify,
} from "@/lib/sound";

const POLL_MS = 5000;

export default function KitchenPage() {
  const router = useRouter();
  const [stationSlug, setStationSlug] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiding, setVoiding] = useState<KitchenItem | null>(null);
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);

  const { data, error, isStale, lastUpdated, refresh } = usePolling<KitchenPayload>(
    "/api/kitchen",
    { intervalMs: POLL_MS }
  );
  const nowMs = useServerClock(data?.serverTime);

  // Initial station from deep link (?station=grill) or last choice.
  // Deliberately runs once after mount (not in a lazy initializer) so the SSR
  // markup stays deterministic and hydration-safe.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("station");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted settings
    setStationSlug(fromUrl ?? localStorage.getItem("kitchen-station") ?? "all");
    const storedSound = localStorage.getItem("kitchen-sound");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted settings
    if (storedSound !== null) setSoundEnabled(storedSound === "1");
  }, []);

  // iOS/Safari: audio can only be unlocked from a user gesture.
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  const selectStation = (slug: string) => {
    setStationSlug(slug);
    localStorage.setItem("kitchen-station", slug);
    window.history.replaceState(
      null,
      "",
      slug === "all" ? "/kitchen" : `/kitchen?station=${slug}`
    );
  };

  // New-ticket alert: chime + vibrate + optional notification.
  const seenTickets = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.tickets.map((t) => t.orderId));
    const seen = seenTickets.current;
    seenTickets.current = ids;
    if (!seen) return;
    const fresh = [...ids].filter((id) => !seen.has(id));
    if (fresh.length === 0) return;
    if (soundEnabled) {
      playChime();
      vibrate();
    }
    const ticket = data.tickets.find((t) => t.orderId === fresh[0]);
    if (ticket) {
      notify(
        "Νέα παραγγελία",
        `#${ticket.dailyNumber}${ticket.tableNumber ? ` · Τραπέζι ${ticket.tableNumber}` : ""}`
      );
    }
  }, [data, soundEnabled]);

  /** Fire-and-forget item/order action; returns success so optimism can revert. */
  const act = useCallback(
    async (url: string, body: unknown): Promise<boolean> => {
      setActionError(null);
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push("/login?callbackUrl=%2Fkitchen");
          return false;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setActionError(
            typeof err?.error === "string" ? err.error : "Η ενέργεια απέτυχε"
          );
          return false;
        }
        return true;
      } catch {
        setActionError("Πρόβλημα δικτύου");
        return false;
      } finally {
        refresh();
      }
    },
    [refresh, router]
  );

  const onBump = useCallback(
    async (item: KitchenItem) => {
      setOptimisticDone((prev) => new Set(prev).add(item.id));
      const ok = await act(`/api/orders/${item.orderId}/items/${item.id}`, {
        action: "bump",
      });
      if (!ok) {
        setOptimisticDone((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [act]
  );

  const onUnbump = useCallback(
    (item: KitchenItem) => act(`/api/orders/${item.orderId}/items/${item.id}`, { action: "unbump" }),
    [act]
  );

  const onFire = useCallback(
    (item: KitchenItem) => act(`/api/orders/${item.orderId}/items/${item.id}`, { action: "fire" }),
    [act]
  );

  const onFireAll = useCallback(
    (ticket: KitchenTicket) => act(`/api/orders/${ticket.orderId}`, { action: "fire" }),
    [act]
  );

  const onVoidConfirm = useCallback(
    async (reason: VoidReason, note?: string) => {
      if (!voiding) return;
      const item = voiding;
      setVoiding(null);
      await act(`/api/orders/${item.orderId}/items/${item.id}`, {
        action: "void",
        reason,
        note,
      });
    },
    [act, voiding]
  );

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      localStorage.setItem("kitchen-sound", prev ? "0" : "1");
      if (!prev) unlockAudio();
      return !prev;
    });
  };

  const enableNotifications = async () => {
    const granted = await requestNotifyPermission();
    setNotifyOn(granted);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen unsupported (iOS Safari) — ignore.
    }
  };

  // Apply optimistic bumps, then scope to the selected station.
  const stations = data?.stations ?? [];
  const tickets = useMemo(() => {
    const all = (data?.tickets ?? []).map<KitchenTicket>((t) => ({
      ...t,
      items: t.items.map((i) =>
        optimisticDone.has(i.id) && i.status === "queued" ? { ...i, status: "done" } : i
      ),
    }));
    if (stationSlug === "all") return all;
    const st = stations.find((s) => s.slug === stationSlug);
    if (!st) return [];
    return all
      .map((t) => ({ ...t, items: t.items.filter((i) => i.stationId === st.id) }))
      .filter((t) => t.items.length > 0);
  }, [data?.tickets, stationSlug, stations, optimisticDone]);

  const openCountFor = useCallback(
    (stationId: string) =>
      (data?.tickets ?? []).reduce(
        (sum, t) =>
          sum +
          t.items.filter(
            (i) => i.stationId === stationId && (i.status === "queued" || i.status === "held")
          ).length,
        0
      ),
    [data?.tickets]
  );

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.floor((nowMs - lastUpdated.getTime()) / 1000))
    : null;

  return (
    <div className="h-dvh flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Station selector + controls */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface overflow-x-auto scrollbar-hide shrink-0">
        <span className="material-symbols-outlined text-primary text-2xl shrink-0">skillet</span>
        <button
          onClick={() => selectStation("all")}
          className={cn(
            "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap min-h-[44px] shrink-0",
            stationSlug === "all"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
          )}
        >
          Όλα
        </button>
        {stations.map((st) => (
          <button
            key={st.id}
            onClick={() => selectStation(st.slug)}
            className={cn(
              "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap min-h-[44px] flex items-center gap-1.5 shrink-0",
              stationSlug === st.slug
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
            )}
          >
            {st.nameEl}
            <span
              className={cn(
                "px-1.5 rounded-full text-xs font-bold",
                stationSlug === st.slug
                  ? "bg-on-primary/20 text-on-primary"
                  : "bg-primary-container text-on-primary-container"
              )}
            >
              {openCountFor(st.id)}
            </span>
          </button>
        ))}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <span className="text-xs text-outline whitespace-nowrap hidden sm:inline">
            {isStale ? "ΑΠΟΣΥΝΔΕΣΗ…" : secondsAgo !== null ? `${secondsAgo}s πριν` : "…"}
          </span>
          <button
            onClick={toggleSound}
            className="text-outline hover:bg-surface-container-high p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={soundEnabled ? "Ήχος: ON" : "Ήχος: OFF"}
          >
            <span className="material-symbols-outlined">
              {soundEnabled ? "volume_up" : "volume_off"}
            </span>
          </button>
          {!notifyOn && (
            <button
              onClick={enableNotifications}
              className="text-outline hover:bg-surface-container-high p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Ενεργοποίηση ειδοποιήσεων"
            >
              <span className="material-symbols-outlined">notifications_active</span>
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="text-outline hover:bg-surface-container-high p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Λειτουργία πλήρους οθόνης"
          >
            <span className="material-symbols-outlined">fullscreen</span>
          </button>
        </div>
      </header>

      {(isStale || error) && (
        <div className="bg-warning-container text-on-warning-container px-4 py-2 text-sm font-semibold text-center shrink-0">
          Αποσυνδέθηκε — επανασύνδεση…
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="bg-error-container text-error px-4 py-2 text-sm font-semibold text-center shrink-0"
        >
          {actionError}
        </div>
      )}

      {/* Ticket grid */}
      <main className="flex-1 overflow-y-auto p-3">
        {tickets.length === 0 ? (
          <div className="text-center py-16 text-outline">
            <span className="material-symbols-outlined text-[64px] block mb-3">
              skillet
            </span>
            <p className="text-lg font-semibold">Καμία ενεργή παραγγελία</p>
            <p className="text-sm mt-1">Οι νέες παραγγελίες εμφανίζονται αυτόματα</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 content-start">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.orderId}
                ticket={ticket}
                nowMs={nowMs}
                onBump={onBump}
                onUnbump={onUnbump}
                onFire={onFire}
                onFireAll={() => onFireAll(ticket)}
                onVoid={setVoiding}
              />
            ))}
          </div>
        )}
      </main>

      {voiding && (
        <VoidModal
          title="Ακύρωση προϊόντος"
          subtitle={voiding.nameEl}
          confirmLabel="Ακύρωση προϊόντος"
          onConfirm={onVoidConfirm}
          onCancel={() => setVoiding(null)}
        />
      )}
    </div>
  );
}
