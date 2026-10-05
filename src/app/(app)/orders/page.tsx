"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { useServerClock } from "@/hooks/useServerClock";
import { StatusChip } from "@/components/service/StatusChip";
import { TableView } from "@/components/service/TableView";
import { playChime } from "@/lib/sound";
import { Button } from "@/components/ui/Button";
import { calculateLineTotal, formatPrice, formatWeight, cn } from "@/lib/utils";
import {
  ageClass,
  ageChipClasses,
  formatAge,
  guestsLabel,
  voidReasonMeta,
} from "@/lib/kitchen";
import type { BoardOrder, OrdersPayload } from "@/lib/kitchen";

const POLL_MS = 5000;

type HistoryRange = "today" | "week" | "month" | "all";
type StatusFilter = "all" | "inprogress" | "ready" | "served";

/** Athens business-date string (YYYY-MM-DD) N days ago. */
function athensDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Europe/Athens",
  });
}

const RANGE_FROM: Record<Exclude<HistoryRange, "all">, string> = {
  today: athensDateDaysAgo(0),
  week: athensDateDaysAgo(6),
  month: athensDateDaysAgo(29),
};

function timeEl(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

export default function OrdersPage() {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [view, setView] = useState<"list" | "tables">("list");
  const [range, setRange] = useState<HistoryRange>("week");
  const [day, setDay] = useState("");
  const [tableMode, setTableMode] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paying, setPaying] = useState<BoardOrder | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [readyToast, setReadyToast] = useState<string | null>(null);
  const prevReadyRef = useRef<Set<string> | null>(null);
  // A specific picked day overrides the range chips.
  const window =
    tab === "closed" && day
      ? `&from=${day}&to=${day}`
      : tab === "closed" && range !== "all"
        ? `&from=${RANGE_FROM[range]}`
        : "";
  const { data, isStale, refresh } = usePolling<OrdersPayload>(
    `/api/orders?scope=${tab}${window}`,
    { intervalMs: POLL_MS }
  );
  const nowMs = useServerClock(data?.serverTime);

  // Remember the last view. One-time client init keeps SSR markup deterministic.
  useEffect(() => {
    const stored = localStorage.getItem("orders-view");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted setting
    if (stored === "list" || stored === "tables") setView(stored);
  }, []);

  const selectView = (next: "list" | "tables") => {
    setView(next);
    localStorage.setItem("orders-view", next);
  };

  const orders = useMemo(() => {
    let list = [...(data?.orders ?? [])];
    if (tab === "active") {
      if (statusFilter === "inprogress") {
        list = list.filter((o) => o.status === "sent" || o.status === "preparing");
      } else if (statusFilter === "ready") {
        list = list.filter((o) => o.status === "ready");
      } else if (statusFilter === "served") {
        list = list.filter((o) => o.status === "served");
      }
      list.sort((a, b) => {
        const aReady = a.status === "ready" ? 1 : 0;
        const bReady = b.status === "ready" ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        return Date.parse(a.sentAt) - Date.parse(b.sentAt);
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (o) =>
          String(o.dailyNumber).includes(q) ||
          o.tableNumber?.toLowerCase().includes(q) ||
          o.cancelNote?.toLowerCase().includes(q) ||
          o.refundNote?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.orders, tab, query, statusFilter]);

  // Notification: chime + toast when an order turns Έτοιμο (new vs last poll).
  const readyIds = useMemo(
    () => new Set(orders.filter((o) => o.status === "ready").map((o) => o.id)),
    [orders]
  );
  const seenReadyRef = useRef<Set<string> | null>(null);
  const seenReady = seenReadyRef.current;
  useEffect(() => {
    if (tab !== "active") return;
    const fresh = [...readyIds].filter((id) => !seenReady?.has(id));
    if (seenReady === null) {
      seenReadyRef.current = readyIds;
      return;
    }
    seenReadyRef.current = readyIds;
    if (fresh.length === 0) return;
    if (soundOn) playChime();
    const names = fresh
      .map((id) => orders.find((o) => o.id === id))
      .filter((o): o is BoardOrder => !!o)
      .map((o) => `#${o.dailyNumber}`);
    setReadyToast(`Έτοιμη: ${names.join(", ")}`);
  }, [readyIds, orders, tab, soundOn]);

  // Auto-clear the ready toast
  const readyToastTimer = readyToast;
  useEffect(() => {
    if (!readyToastTimer) return;
    const t = setTimeout(() => setReadyToast(null), 6000);
    return () => clearTimeout(t);
  }, [readyToastTimer]);

  const handleServe = async (id: string) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "serve" }),
    });
    refresh();
  };

  const handlePay = async (order: BoardOrder) => {
    setPaying(null);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid" }),
    });
    refresh();
  };

  const tableView = tab === "active" && view === "tables";

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto min-w-0">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-3xl font-bold text-on-surface">Παραγγελίες</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {tab === "active" && (
            <div className="flex bg-surface-container-low rounded-full p-1">
              <button
                onClick={() => selectView("list")}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[44px] flex items-center gap-1.5",
                  view === "list"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">list</span>
                Λίστα
              </button>
              <button
                onClick={() => selectView("tables")}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[44px] flex items-center gap-1.5",
                  view === "tables"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">table_restaurant</span>
                Τραπέζια
              </button>
            </div>
          )}
          <div className="flex bg-surface-container-low rounded-full p-1">
            <button
              onClick={() => setTab("active")}
              className={cn(
                "px-5 py-2 rounded-full font-bold text-sm min-h-[44px]",
                tab === "active"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface hover:bg-surface-container-high"
              )}
            >
              Ενεργές
            </button>
            <button
              onClick={() => setTab("closed")}
              className={cn(
                "px-5 py-2 rounded-full font-bold text-sm min-h-[44px]",
                tab === "closed"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface hover:bg-surface-container-high"
              )}
            >
              Ιστορικό
            </button>
          </div>
        </div>
      </div>

      {isStale && (
        <div className="bg-warning-container text-on-warning-container rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          Αποσύνδεση — επανασύνδεση…
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tab === "active" && view === "list" && (
          <div className="flex bg-surface-container-low rounded-full p-1">
            {([
              ["all", "Όλες"],
              ["inprogress", "Σε εξέλιξη"],
              ["ready", "Έτοιμες"],
              ["served", "Σερβιρισμένες"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[40px]",
                  statusFilter === value
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {tab === "closed" && (
          <>
            <div className="flex bg-surface-container-low rounded-full p-1">
              <button
                onClick={() => setTableMode(false)}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[40px] flex items-center gap-1.5",
                  !tableMode
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                Κάρτες
              </button>
              <button
                onClick={() => setTableMode(true)}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[40px] flex items-center gap-1.5",
                  tableMode
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">table_rows</span>
                Πίνακας
              </button>
            </div>
            <div className="flex bg-surface-container-low rounded-full p-1">
              {([
                ["today", "Σήμερα"],
                ["week", "7 μέρες"],
                ["month", "Μήνας"],
                ["all", "Όλα"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setRange(value);
                    setDay("");
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full font-bold text-sm min-h-[40px]",
                    !day && range === value
                      ? "bg-primary text-on-primary"
                      : "text-on-surface hover:bg-surface-container-high"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-surface border border-outline-variant rounded-full px-4 py-2 text-sm min-h-[44px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              title="Συγκεκριμένη ημέρα"
            />
          </>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <span className="material-symbols-outlined text-outline absolute left-3 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αριθμός ή τραπέζι…"
            className="w-full bg-surface border border-outline-variant rounded-full pl-10 pr-3 py-2 text-base min-h-[44px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {readyToast && (
        <div
          className="bg-primary text-on-primary rounded-xl px-4 py-2.5 text-sm font-bold mb-3 flex items-center gap-2 shadow-lg"
          role="status"
        >
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          {readyToast}
        </div>
      )}

      {tableView ? (
        <TableView orders={orders} nowMs={nowMs} />
      ) : tab === "closed" && tableMode ? (
        <OrdersTable orders={orders} />
      ) : orders.length === 0 ? (
        <div className="text-center py-10 text-outline">
          <span className="material-symbols-outlined text-[64px] block mb-3">
            receipt_long
          </span>
          <p className="text-lg">
            {tab === "active" ? "Καμία ενεργή παραγγελία" : "Κανένα ιστορικό"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode={tab}
              nowMs={nowMs}
              onServe={() => handleServe(order.id)}
              onPay={() => setPaying(order)}
            />
          ))}
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-outline-variant">
              <h2 className="text-xl font-bold text-on-surface">
                Κλείσιμο #{paying.dailyNumber} ως Πληρωμένη
              </h2>
            </div>
            <div className="p-6">
              {paying.itemCount - paying.doneCount - paying.voidedCount > 0 ? (
                <>
                  <p className="text-sm text-on-surface mb-2 font-semibold">
                    Προσοχή — υπάρχουν προϊόντα που δεν έχουν ετοιμαστεί:
                  </p>
                  <ul className="text-sm text-outline list-disc pl-5">
                    {paying.items
                      .filter((i) => i.status !== "done" && i.status !== "voided")
                      .map((i) => (
                        <li key={i.orderId + i.nameEl + i.round}>{i.nameEl}</li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-outline">
                  Όλα τα προϊόντα είναι έτοιμα. Σύνολο:{" "}
                  <span className="font-bold text-primary">
                    {formatPrice(paying.totalCents)}
                  </span>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
              <Button variant="ghost" size="md" onClick={() => setPaying(null)}>
                Πίσω
              </Button>
              <Button variant="primary" size="md" onClick={() => handlePay(paying)}>
                Πληρώθηκε
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dense per-day register — click a row for the full order. */
function OrdersTable({ orders }: { orders: BoardOrder[] }) {
  const router = useRouter();
  return (
    <div className="bg-surface rounded-xl border border-outline-variant overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="bg-surface-container-low text-left text-xs font-semibold text-outline">
            <th className="p-3">#</th>
            <th className="p-3">Ημερομηνία</th>
            <th className="p-3">Ώρα</th>
            <th className="p-3">Τραπέζι</th>
            <th className="p-3">Άτομα</th>
            <th className="p-3">Είδη</th>
            <th className="p-3 text-right">Σύνολο</th>
            <th className="p-3">Κατάσταση</th>
            <th className="p-3">Σημειώσεις</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              onClick={() => router.push(`/orders/${o.id}`)}
              className="border-t border-outline-variant hover:bg-surface-container-low cursor-pointer"
            >
              <td className="p-3 font-bold text-on-surface">{o.dailyNumber}</td>
              <td className="p-3 text-outline">{o.businessDate}</td>
              <td className="p-3 text-outline">{timeEl(o.sentAt)}</td>
              <td className="p-3 font-semibold text-on-surface">
                {o.tableNumber ?? "Takeaway"}
              </td>
              <td className="p-3 text-outline">{guestsLabel(o.guests) || "—"}</td>
              <td className="p-3 text-outline">{o.itemCount}</td>
              <td className="p-3 text-right font-bold text-on-surface">
                {formatPrice(o.totalCents)}
              </td>
              <td className="p-3">
                <StatusChip status={o.status} />
              </td>
              <td className="p-3 text-xs text-outline">
                {o.cancelReason ? `Ακύρωση: ${voidReasonMeta[o.cancelReason]}` : ""}
                {o.refundReason ? `Επιστροφή: ${voidReasonMeta[o.refundReason]}` : ""}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={9} className="p-6 text-center text-outline">
                Κανένα ιστορικό για την επιλεγμένη περίοδο.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrderCard({
  order,
  mode,
  nowMs,
  onServe,
  onPay,
}: {
  order: BoardOrder;
  mode: "active" | "closed";
  nowMs: number;
  onServe: () => void;
  onPay: () => void;
}) {
  const age = ageClass(order.sentAt, nowMs);
  const isReady = order.status === "ready";
  const badge = order.tableNumber ?? "TA";
  const shownItems = order.items.slice(0, 4);
  const hiddenItems = Math.max(0, order.items.length - shownItems.length);

  return (
    <div
      className={cn(
        "bg-surface border rounded-xl p-4 flex flex-col gap-3 transition-colors",
        isReady
          ? "border-primary bg-primary-container/20"
          : order.priority
            ? "border-2 border-error"
            : "border-outline-variant"
      )}
    >
      {/* Header: table badge + order info + status */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center font-extrabold shrink-0",
            order.tableNumber
              ? "bg-primary-container text-on-primary-container"
              : "bg-secondary-container text-on-secondary-container"
          )}
        >
          <span className={cn(badge.length > 3 ? "text-[10px] px-1 text-center" : "text-sm")}>
            {badge}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface leading-tight">
            #{order.dailyNumber}
            {guestsLabel(order.guests) && (
              <span className="text-outline font-semibold"> · {guestsLabel(order.guests)}</span>
            )}
          </p>
          <p className="text-xs text-outline truncate">
            {order.guestName ? `${order.guestName} · ` : ""}
            {order.tableNumber ? "Τραπέζι" : "Takeaway"}
            {order.priority && (
              <span className="text-error font-bold"> · ΠΡΟΤΕΡΑΙΟΤΗΤΑ</span>
            )}
          </p>
        </div>
        <StatusChip status={order.status} />
      </div>

      {/* Date / time + age */}
      <div className="flex justify-between items-center text-xs text-outline">
        <span>{order.businessDate}</span>
        {mode === "active" ? (
          <span className={cn("px-2 py-0.5 rounded-lg font-bold", ageChipClasses[age])}>
            {formatAge(order.sentAt, nowMs)}
          </span>
        ) : (
          <span>{timeEl(order.sentAt)}</span>
        )}
      </div>

      {/* Items table */}
      <div className="border-t border-outline-variant pt-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] font-semibold text-outline mb-1">
          <span>Προϊόν</span>
          <span className="text-right">Τεμ.</span>
          <span className="text-right w-16">Τιμή</span>
        </div>
        {shownItems.map((it, idx) => (
          <div
            key={`${it.round}-${idx}-${it.nameEl}`}
            className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-sm py-0.5"
          >
            <span
              className={cn(
                "truncate text-on-surface",
                it.status === "voided" && "line-through opacity-50"
              )}
            >
              {it.nameEl}
            </span>
            <span className="text-right text-outline">
              {it.pricingType === "weight"
                ? formatWeight(it.quantityGrams)
                : it.quantityGrams / 1000}
            </span>
            <span
              className={cn(
                "text-right w-16 text-on-surface",
                it.status === "voided" && "line-through opacity-50"
              )}
            >
              {formatPrice(calculateLineTotal(it.priceAtTimeCents, it.quantityGrams))}
            </span>
          </div>
        ))}
        {hiddenItems > 0 && (
          <div className="text-xs font-semibold text-primary mt-1">
            +{hiddenItems} ακόμη
          </div>
        )}
      </div>

      {/* Item statuses (live from kitchen) */}
      <div className="border-t border-outline-variant pt-2">
        {shownItems.map((it, idx) => (
          <div key={`${it.round}-${idx}`} className="flex items-center gap-1.5 text-xs py-0.5">
            {it.status === "done" ? (
              <span className="material-symbols-outlined text-[14px] text-success shrink-0">check_circle</span>
            ) : it.status === "in_progress" ? (
              <span className="material-symbols-outlined text-[14px] text-secondary shrink-0">local_fire_department</span>
            ) : it.status === "held" ? (
              <span className="material-symbols-outlined text-[14px] text-outline shrink-0">schedule</span>
            ) : (
              <span className="material-symbols-outlined text-[14px] text-outline shrink-0">radio_button_unchecked</span>
            )}
            <span className={cn("truncate text-on-surface", it.status === "voided" && "line-through opacity-50")}>
              {it.nameEl}
              {it.status === "in_progress" && <span className="text-secondary font-semibold"> · Στο ψήσιμο</span>}
              {it.status === "held" && <span className="text-outline"> · Αναμονή</span>}
            </span>
            {it.round > 1 && (
              <span className="text-[9px] font-bold text-outline shrink-0">R{it.round}</span>
            )}
          </div>
        ))}
        {order.items.length > shownItems.length && (
          <div className="text-[10px] font-semibold text-primary mt-0.5">
            +{order.items.length - shownItems.length} ακόμη
          </div>
        )}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center border-t border-outline-variant pt-2">
        <span className="text-sm text-outline">Σύνολο</span>
        <span className="text-lg font-extrabold text-on-surface">
          {formatPrice(order.totalCents)}
        </span>
      </div>

      {/* Closed-order meta */}
      {mode === "closed" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {order.cancelReason && (
            <span className="bg-error-container text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
              Ακύρωση: {voidReasonMeta[order.cancelReason]}
            </span>
          )}
          {order.refundReason && (
            <span className="bg-error-container text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
              ΕΠΙΣΤΡΟΦΗ: {voidReasonMeta[order.refundReason]}
            </span>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 mt-auto">
        <Link href={`/orders/${order.id}`} className="flex-1">
          <Button variant="ghost" size="md" className="w-full">
            Λεπτομέρειες
          </Button>
        </Link>
        {mode === "active" && isReady && (
          <Button variant="primary" size="md" onClick={onServe}>
            <span className="material-symbols-outlined text-[20px]">room_service</span>
            Σερβίρισμα
          </Button>
        )}
        {mode === "active" && order.status === "served" && (
          <Button variant="primary" size="md" onClick={onPay}>
            <span className="material-symbols-outlined text-[20px]">payments</span>
            Πληρωμή
          </Button>
        )}
      </div>

      {isReady && mode === "active" && (
        <div className="text-center bg-primary text-on-primary rounded-lg py-1.5 text-xs font-bold animate-pulse -mt-1">
          ΣΕΡΒΙΡΙΣΤΕ ΤΩΡΑ
        </div>
      )}
    </div>
  );
}
