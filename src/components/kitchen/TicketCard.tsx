"use client";

import { formatWeight } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ageClass, ageChipClasses, formatAge } from "@/lib/kitchen";
import type { KitchenItem, KitchenTicket } from "@/lib/kitchen";

interface TicketCardProps {
  ticket: KitchenTicket;
  /** Skew-adjusted current time (server clock), for age chips. */
  nowMs: number;
  onBump: (item: KitchenItem) => void;
  onUnbump: (item: KitchenItem) => void;
  onStart: (item: KitchenItem) => void;
  onUnstart: (item: KitchenItem) => void;
  onFire: (item: KitchenItem) => void;
  onFireAll: () => void;
  onVoid: (item: KitchenItem) => void;
}

/** One kitchen ticket: active items grouped by round, undo strip, held zone. */
export function TicketCard({
  ticket,
  nowMs,
  onBump,
  onUnbump,
  onStart,
  onUnstart,
  onFire,
  onFireAll,
  onVoid,
}: TicketCardProps) {
  const active = ticket.items.filter(
    (i) => i.status === "queued" || i.status === "in_progress"
  );
  const held = ticket.items.filter((i) => i.status === "held");
  const done = ticket.items.filter((i) => i.status === "done");
  const rounds = [...new Set(active.map((i) => i.round))].sort((a, b) => a - b);

  const showAge = active.length > 0 && ticket.oldestActiveAt;
  const age = ageClass(ticket.oldestActiveAt, nowMs);

  // Just-served: a brief farewell bar so the kitchen sees the order leave.
  if (ticket.status === "served") {
    return (
      <div className="bg-surface border border-primary/40 rounded-xl p-2.5 opacity-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-outline">
            #{ticket.dailyNumber}
            {ticket.tableNumber ? ` · Τραπέζι ${ticket.tableNumber}` : ""}
          </span>
          <span className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">room_service</span>
            ΣΕΡΒΙΡΙΣΤΗΚΕ
          </span>
        </div>
      </div>
    );
  }

  // Fully bumped for this station: collapse to a slim bar (undo window only).
  if (active.length === 0 && held.length === 0 && done.length > 0) {
    return (
      <div className="bg-surface border border-outline-variant/60 rounded-xl p-2.5 opacity-70">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-outline">
            #{ticket.dailyNumber}
            {ticket.tableNumber ? ` · Τραπέζι ${ticket.tableNumber}` : ""}
          </span>
          <span className="text-xs font-semibold text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Ετοιμο · {done.length} είδη
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {done.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-0.5 text-[11px] bg-surface-container-low rounded-full pl-2 pr-0.5 py-0.5 text-outline line-through"
            >
              {item.nameEl}
              <button
                onClick={() => onUnbump(item)}
                className="text-primary hover:text-on-surface flex items-center"
                title="Αναίρεση"
              >
                <span className="material-symbols-outlined text-[12px] no-underline">undo</span>
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-surface rounded-2xl flex flex-col overflow-hidden shadow-sm",
        ticket.priority ? "border-2 border-error" : "border border-outline-variant"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-3xl font-extrabold text-on-surface leading-none">
            #{ticket.dailyNumber}
          </span>
          <span className="text-sm font-semibold text-outline truncate">
            {ticket.tableNumber ? `Τραπέζι ${ticket.tableNumber}` : "Takeaway"}
            {ticket.guestName && ` · ${ticket.guestName}`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.priority && (
            <span className="bg-error text-on-error px-2 py-1 rounded-full text-xs font-bold animate-pulse">
              ΠΡΟΤΕΡΑΙΟΤΗΤΑ
            </span>
          )}
          {showAge && (
            <span
              className={cn("px-3 py-1 rounded-lg font-bold text-lg", ageChipClasses[age])}
              title="Χρόνος αναμονής"
            >
              {formatAge(ticket.oldestActiveAt!, nowMs)}
            </span>
          )}
        </div>
      </div>

      {/* Active items, grouped by round */}
      <div className="flex flex-col">
        {rounds.map((round) => (
          <div key={round}>
            {rounds.length > 1 && (
              <div className="px-3 pt-2">
                <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-xs font-bold">
                  R{round}
                </span>
              </div>
            )}
            {active
              .filter((i) => i.round === round)
              .map((item) => {
                const inProgress = item.status === "in_progress";
                const grillMinutes = item.startedAt
                  ? Math.max(0, Math.floor((nowMs - Date.parse(item.startedAt)) / 60000))
                  : 0;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-stretch border-b border-outline-variant/50 last:border-0",
                      inProgress && "bg-warning-container/40"
                    )}
                  >
                    <button
                      onClick={() => (inProgress ? onBump(item) : onStart(item))}
                      className="flex-1 min-h-[56px] px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-primary-container/10 active:bg-primary-container/20 transition-colors"
                      title={
                        inProgress
                          ? "Έτοιμο — πάτα όταν βγει από τη σχάρα"
                          : "Στο ψήσιμο — πάτα όταν ξεκινήσει"
                      }
                    >
                      <span className="min-w-0">
                        <span className="font-bold text-on-surface text-base">
                          {item.nameEl}
                        </span>
                        {item.pricingType === "weight" && (
                          <span className="text-outline text-sm font-semibold ml-2">
                            {formatWeight(item.quantityGrams)}
                          </span>
                        )}
                        {item.notes && (
                          <span className="block text-xs font-semibold text-tertiary">
                            {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {inProgress && (
                          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Στο ψήσιμο{" "}
                            {item.startedAt
                              ? Math.max(0, Math.floor((nowMs - Date.parse(item.startedAt)) / 60000)) + "′"
                              : ""}
                          </span>
                        )}
                        <span
                          className={cn(
                            "material-symbols-outlined shrink-0",
                            inProgress ? "text-primary" : "text-outline"
                          )}
                        >
                          {inProgress ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => onVoid(item)}
                      className="w-12 flex items-center justify-center text-outline hover:bg-error-container/10 hover:text-error border-l border-outline-variant/50 min-h-[48px]"
                      title="Ακύρωση προϊόντος"
                    >
                      <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Done strip — brief undo window */}
      {done.length > 0 && (
        <div className="border-t border-outline-variant bg-surface-container-low/60">
          {done.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-1">
              <span className="text-sm text-outline line-through truncate">
                {item.nameEl}
                {item.pricingType === "weight" && (
                  <span className="ml-1 not-italic">{formatWeight(item.quantityGrams)}</span>
                )}
              </span>
              <button
                onClick={() => onUnbump(item)}
                className="text-outline hover:text-primary flex items-center gap-1 text-xs font-semibold min-h-[40px] px-2 shrink-0"
                title="Αναίρεση σβησίματος"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                Αναίρεση
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Held zone — not fired yet, invisible to the cook until fired */}
      {held.length > 0 && (
        <div className="border-t border-dashed border-outline-variant bg-surface-container-lowest">
          <div className="px-3 py-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              Αναμονή ({held.length})
            </span>
            <button
              onClick={onFireAll}
              className="flex items-center gap-1 bg-secondary text-on-secondary px-3 py-2 rounded-lg text-xs font-bold min-h-[40px]"
              title="Άναμμα όλων των σε αναμονή"
            >
              <span className="material-symbols-outlined text-[16px]">
                local_fire_department
              </span>
              Άναμμα ({held.length})
            </button>
          </div>
          {held.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-0.5">
              <span className="text-sm text-outline italic truncate">{item.nameEl}</span>
              <button
                onClick={() => onFire(item)}
                className="text-secondary hover:text-on-secondary min-h-[40px] px-2 flex items-center shrink-0"
                title="Άναμμα"
              >
                <span className="material-symbols-outlined text-[18px]">
                  local_fire_department
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cross-station context */}
      {ticket.otherOpenCount > 0 && (
        <div className="px-3 py-1.5 border-t border-outline-variant text-xs text-outline">
          Άλλοι σταθμοί: {ticket.otherOpenCount} ανοιχτά
        </div>
      )}
    </div>
  );
}
