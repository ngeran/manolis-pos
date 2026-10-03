"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { StatusChip } from "@/components/service/StatusChip";
import { VoidModal } from "@/components/kitchen/VoidModal";
import { Button } from "@/components/ui/Button";
import { useOrderStore } from "@/lib/store";
import { formatPrice, formatWeight, cn, calculateLineTotal } from "@/lib/utils";
import { orderStatusMeta, voidReasonMeta, guestsLabel } from "@/lib/kitchen";
import type { OrderDetailItem, OrderDetailPayload } from "@/lib/kitchen";
import type { VoidReason } from "@/lib/db/schema";

const POLL_MS = 5000;

function timeEl(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isStale, refresh } = usePolling<OrderDetailPayload>(`/api/orders/${id}`, {
    intervalMs: POLL_MS,
  });
  const [role, setRole] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<OrderDetailItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => setRole(s?.user?.role ?? null))
      .catch(() => {});
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setActionError(null);
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/orders/${id}`)}`);
          return false;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setActionError(typeof err?.error === "string" ? err.error : "Η ενέργεια απέτυχε");
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
    [id, refresh, router]
  );

  const actItem = useCallback(
    async (itemId: string, body: Record<string, unknown>): Promise<boolean> => {
      setActionError(null);
      try {
        const res = await fetch(`/api/orders/${id}/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/orders/${id}`)}`);
          return false;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setActionError(typeof err?.error === "string" ? err.error : "Η ενέργεια απέτυχε");
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
    [id, refresh, router]
  );

  const order = data;
  const items = order?.items ?? [];
  const openItems = useMemo(() => items.filter((i) => i.status !== "voided"), [items]);
  const heldCount = openItems.filter((i) => i.status === "held").length;
  const terminal =
    order?.status === "paid" || order?.status === "cancelled" || !order;
  const isAdmin = role === "admin";

  // Group by station (in payload order) → rounds within station.
  const stationGroups = useMemo(() => {
    const groups: { name: string; rounds: { round: number; items: OrderDetailItem[] }[] }[] = [];
    for (const item of items) {
      const name = item.stationNameEl ?? "Χωρίς σταθμό";
      let g = groups.find((x) => x.name === name);
      if (!g) {
        g = { name, rounds: [] };
        groups.push(g);
      }
      let r = g.rounds.find((x) => x.round === item.round);
      if (!r) {
        r = { round: item.round, items: [] };
        g.rounds.push(r);
      }
      r.items.push(item);
    }
    return groups;
  }, [items]);

  const handleAddItems = () => {
    if (!order) return;
    useOrderStore.getState().startEditOrder(
      order.id,
      `#${order.dailyNumber}${order.tableNumber ? ` · Τραπέζι ${order.tableNumber}` : ""}`
    );
    router.push("/pos");
  };

  if (!order) {
    return (
      <div className="w-full p-6 flex-grow flex items-center justify-center">
        <p className="text-outline">{isStale ? "Φόρτωση…" : "Η παραγγελία δεν βρέθηκε"}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-grow flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 md:p-6 pb-3 shrink-0">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Παραγγελίες
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold text-on-surface">
            #{order.dailyNumber}
          </h1>
          <span className="text-lg font-semibold text-on-surface">
            {order.tableNumber ? `Τραπέζι ${order.tableNumber}` : "Takeaway"}
            {order.guestName && ` · ${order.guestName}`}
            {guestsLabel(order.guests) && (
              <span className="text-outline font-semibold">
                {" "}
                · {guestsLabel(order.guests)}
              </span>
            )}
          </span>
          <StatusChip status={order.status} />
          {order.priority && (
            <span className="bg-error text-on-error px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
              ΠΡΟΤΕΡΑΙΟΤΗΤΑ
            </span>
          )}
          <span className="ml-auto text-2xl font-bold text-primary">
            {formatPrice(order.totalCents)}
          </span>
        </div>
        <p className="text-xs text-outline mt-1">
          {timeEl(order.sentAt)} · {order.openedByName ?? "—"} ·{" "}
          {orderStatusMeta[order.status].el}
          {order.servedAt ? ` · Σερβιρίστηκε ${timeEl(order.servedAt)}` : ""}
          {order.paidAt ? ` · Πληρώθηκε ${timeEl(order.paidAt)}` : ""}
        </p>
        {order.status === "cancelled" && order.cancelReason && (
          <div className="mt-2 bg-error-container text-error rounded-lg px-3 py-2 text-sm font-semibold">
            Ακυρώθηκε: {voidReasonMeta[order.cancelReason]}
            {order.cancelNote ? ` — ${order.cancelNote}` : ""}
          </div>
        )}
        {order.refundReason && (
          <div className="mt-2 bg-error-container text-error rounded-lg px-3 py-2 text-sm font-semibold">
            ΕΠΙΣΤΡΟΦΗ: {voidReasonMeta[order.refundReason]}
            {order.refundNote ? ` — ${order.refundNote}` : ""}
            {order.refundedAt ? ` · ${timeEl(order.refundedAt)}` : ""}
            {order.refundedByName ? ` · ${order.refundedByName}` : ""}
          </div>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mx-4 md:mx-6 bg-error-container text-error rounded-lg px-3 py-2 text-sm font-semibold shrink-0"
        >
          {actionError}
        </div>
      )}
      {isStale && (
        <div className="mx-4 md:mx-6 bg-warning-container text-on-warning-container rounded-lg px-3 py-2 text-sm font-semibold shrink-0">
          Αποσύνδεση — επανασύνδεση…
        </div>
      )}

      {/* Items grouped by station → round */}
      <div className="flex-1 px-4 md:px-6 py-3 flex flex-col gap-4">
        {stationGroups.map((group) => (
          <div
            key={group.name}
            className="bg-surface rounded-xl border border-outline-variant overflow-hidden"
          >
            <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">
                skillet
              </span>
              {group.name}
            </div>
            {group.rounds
              .sort((a, b) => a.round - b.round)
              .map((round) => (
                <div key={round.round}>
                  {group.rounds.length > 1 && (
                    <div className="px-4 pt-2">
                      <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-xs font-bold">
                        R{round.round}
                      </span>
                    </div>
                  )}
                  {round.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/40 last:border-0",
                        item.status === "voided" && "opacity-60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "font-semibold text-on-surface",
                            item.status === "voided" && "line-through"
                          )}
                        >
                          {item.nameEl}
                        </span>
                        {item.pricingType === "weight" && (
                          <span className="text-outline text-sm ml-2">
                            {formatWeight(item.quantityGrams)}
                          </span>
                        )}
                        {item.notes && (
                          <span className="block text-xs font-semibold text-tertiary">
                            {item.notes}
                          </span>
                        )}
                        {item.status === "voided" && (
                          <span className="block text-xs text-error font-semibold">
                            Ακυρώθηκε: {item.voidedReason ? voidReasonMeta[item.voidedReason] : "—"}
                            {item.voidedByName ? ` · ${item.voidedByName}` : ""}
                            {item.voidedAt ? ` · ${timeEl(item.voidedAt)}` : ""}
                            {item.voidedNote ? ` · ${item.voidedNote}` : ""}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-on-surface shrink-0">
                        {formatPrice(calculateLineTotal(item.priceAtTimeCents, item.quantityGrams))}
                      </span>
                      <span className="shrink-0 w-20 text-right">
                        {item.status === "done" ? (
                          <span className="inline-flex items-center gap-1 text-success font-bold text-sm">
                            <span className="material-symbols-outlined text-[18px]">
                              check_circle
                            </span>
                            {item.doneAt ? timeEl(item.doneAt) : ""}
                          </span>
                        ) : item.status === "held" ? (
                          <span className="inline-flex items-center gap-1 text-outline font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            Αναμονή
                          </span>
                        ) : item.status === "queued" ? (
                          <span className="text-warning font-bold text-xs">Σε εξέλιξη</span>
                        ) : null}
                      </span>
                      {!terminal && item.status !== "voided" && (
                        <button
                          onClick={() => setVoiding(item)}
                          className="text-outline hover:text-error min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                          title="Ακύρωση προϊόντος"
                        >
                          <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Actions */}
      {!terminal && (
        <div className="sticky bottom-0 bg-surface border-t border-outline-variant p-3 px-4 md:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0">
          <div className="flex flex-wrap gap-2">
            {heldCount > 0 && (
              <Button variant="secondary" size="md" onClick={() => act({ action: "fire" })}>
                <span className="material-symbols-outlined text-[20px]">
                  local_fire_department
                </span>
                Άναμμα ({heldCount})
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              onClick={() => act({ action: order.priority ? "unrush" : "rush" })}
            >
              <span className="material-symbols-outlined text-[20px]">bolt</span>
              {order.priority ? "Αφαίρεση προτεραιότητας" : "Προτεραιότητα"}
            </Button>
            <Button variant="ghost" size="md" onClick={handleAddItems}>
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              Προσθήκη
            </Button>
            {order.status === "ready" && (
              <Button variant="primary" size="md" onClick={() => act({ action: "serve" })}>
                <span className="material-symbols-outlined text-[20px]">room_service</span>
                Σερβίρισμα
              </Button>
            )}
            {order.status === "served" && (
              <Button variant="primary" size="md" onClick={() => setConfirmPaid(true)}>
                <span className="material-symbols-outlined text-[20px]">payments</span>
                Κλείσιμο ως Πληρωμένη
              </Button>
            )}
            {isAdmin && order.status === "paid" && !order.refundReason && (
              <Button variant="danger" size="md" onClick={() => setRefundOpen(true)}>
                <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                Επιστροφή
              </Button>
            )}
            <div className="flex-1" />
            {isAdmin && (
              <Button variant="danger" size="md" onClick={() => setCancelling(true)}>
                <span className="material-symbols-outlined text-[20px]">cancel</span>
                Ακύρωση
              </Button>
            )}
          </div>
        </div>
      )}

      {voiding && (
        <VoidModal
          title="Ακύρωση προϊόντος"
          subtitle={voiding.nameEl}
          confirmLabel="Ακύρωση προϊόντος"
          onConfirm={async (reason: VoidReason, note?: string) => {
            const item = voiding;
            setVoiding(null);
            await actItem(item.id, { action: "void", reason, note });
          }}
          onCancel={() => setVoiding(null)}
        />
      )}

      {cancelling && (
        <VoidModal
          title="Ακύρωση παραγγελίας"
          subtitle={`#${order.dailyNumber}${order.tableNumber ? ` · Τραπέζι ${order.tableNumber}` : ""}`}
          confirmLabel="Ακύρωση Παραγγελίας"
          onConfirm={async (reason: VoidReason, note?: string) => {
            setCancelling(false);
            await act({ action: "cancel", reason, note });
          }}
          onCancel={() => setCancelling(false)}
        />
      )}

      {refundOpen && (
        <VoidModal
          title="Σήμανση ως Επιστροφή"
          subtitle={`#${order.dailyNumber}${order.tableNumber ? ` · Τραπέζι ${order.tableNumber}` : ""} · ${formatPrice(order.totalCents)}`}
          confirmLabel="Επιστροφή"
          onConfirm={async (reason: VoidReason, note?: string) => {
            setRefundOpen(false);
            await act({ action: "refund", reason, note });
          }}
          onCancel={() => setRefundOpen(false)}
        />
      )}

      {confirmPaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-outline-variant">
              <h2 className="text-xl font-bold text-on-surface">Κλείσιμο ως Πληρωμένη</h2>
            </div>
            <div className="p-6">
              {heldCount + openItems.filter((i) => i.status === "queued").length > 0 ? (
                <>
                  <p className="text-sm text-on-surface mb-2 font-semibold">
                    Προσοχή — υπάρχουν προϊόντα που δεν έχουν ετοιμαστεί:
                  </p>
                  <ul className="text-sm text-outline list-disc pl-5">
                    {openItems
                      .filter((i) => i.status !== "done")
                      .map((i) => (
                        <li key={i.id}>{i.nameEl}</li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-outline">
                  Όλα τα προϊόντα είναι έτοιμα. Σύνολο:{" "}
                  <span className="font-bold text-primary">
                    {formatPrice(order.totalCents)}
                  </span>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
              <Button variant="ghost" size="md" onClick={() => setConfirmPaid(false)}>
                Πίσω
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  setConfirmPaid(false);
                  await act({ action: "paid" });
                }}
              >
                Πληρώθηκε
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
