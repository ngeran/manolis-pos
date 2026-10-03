"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import { useServerClock } from "@/hooks/useServerClock";
import { StatusChip } from "@/components/service/StatusChip";
import { TableView } from "@/components/service/TableView";
import { formatPrice, cn } from "@/lib/utils";
import { ageClass, ageChipClasses, formatAge, guestsLabel, voidReasonMeta } from "@/lib/kitchen";
import type { BoardOrder, OrdersPayload } from "@/lib/kitchen";

const POLL_MS = 5000;

type HistoryRange = "today" | "week" | "month" | "all";

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

export default function OrdersPage() {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [view, setView] = useState<"list" | "tables">("list");
  const [range, setRange] = useState<HistoryRange>("week");
  const [query, setQuery] = useState("");
  const fromParam = tab === "closed" && range !== "all" ? `&from=${RANGE_FROM[range]}` : "";
  const { data, isStale } = usePolling<OrdersPayload>(
    `/api/orders?scope=${tab}${fromParam}`,
    { intervalMs: POLL_MS }
  );
  const nowMs = useServerClock(data?.serverTime);

  // Remember the last view. One-time client init keeps SSR markup deterministic.
  useEffect(() => {
    const stored = localStorage.getItem("orders-view");
    if (stored === "list" || stored === "tables") setView(stored);
  }, []);

  const selectView = (next: "list" | "tables") => {
    setView(next);
    localStorage.setItem("orders-view", next);
  };

  const tableView = tab === "active" && view === "tables";

  const orders = useMemo(() => {
    let list = [...(data?.orders ?? [])];
    if (tab === "active") {
      list.sort((a, b) => {
        const aReady = a.status === "ready" ? 1 : 0;
        const bReady = b.status === "ready" ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        return Date.parse(a.sentAt) - Date.parse(b.sentAt);
      });
    } else if (query.trim()) {
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
  }, [data?.orders, tab, query]);

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
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

      {tab === "closed" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex bg-surface-container-low rounded-full p-1">
            {([
              ["today", "Σήμερα"],
              ["week", "7 μέρες"],
              ["month", "Μήνας"],
              ["all", "Όλα"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm min-h-[40px]",
                  range === value
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
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
      )}

      {tableView ? (
        <TableView orders={orders} nowMs={nowMs} />
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
        <div className="space-y-3">
          {orders.map((order) => (
            <BoardCard key={order.id} order={order} nowMs={nowMs} mode={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({
  order,
  nowMs,
  mode,
}: {
  order: BoardOrder;
  nowMs: number;
  mode: "active" | "closed";
}) {
  const age = ageClass(order.sentAt, nowMs);
  const isReady = order.status === "ready";

  return (
    <Link
      href={`/orders/${order.id}`}
      className={cn(
        "block bg-surface border rounded-xl p-4 transition-all hover:border-primary-container",
        isReady
          ? "border-primary bg-primary-container/20"
          : order.priority
            ? "border-2 border-error"
            : "border-outline-variant"
      )}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-extrabold text-on-surface leading-none">
              #{order.dailyNumber}
            </span>
            <span className="font-semibold text-on-surface">
              {order.tableNumber ? `Τραπέζι ${order.tableNumber}` : "Takeaway"}
              {guestsLabel(order.guests) && (
                <span className="text-outline font-semibold">
                  {" "}
                  · {guestsLabel(order.guests)}
                </span>
              )}
            </span>
            {order.priority && (
              <span className="bg-error text-on-error px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                ΠΡΟΤΕΡΑΙΟΤΗΤΑ
              </span>
            )}
          </div>

          {mode === "active" ? (
            <>
              {order.stations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {order.stations.map((st) => (
                    <span
                      key={st.slug}
                      className="bg-surface-container-low border border-outline-variant rounded-full px-2.5 py-0.5 text-xs font-semibold text-on-surface"
                    >
                      {st.nameEl} {st.doneCount}/{st.doneCount + st.openCount}
                    </span>
                  ))}
                </div>
              )}
              {order.heldCount > 0 && (
                <span className="inline-block mt-1.5 text-xs font-semibold text-tertiary">
                  Αναμονή: {order.heldCount}
                </span>
              )}
            </>
          ) : (
            <span className="block text-xs text-outline mt-1">
              {order.businessDate}
              {order.openedByName ? ` · Άνοιξε: ${order.openedByName}` : ""}
              {order.cancelReason
                ? ` · Ακύρωση: ${voidReasonMeta[order.cancelReason]}`
                : ""}
              {order.refundReason
                ? ` · Επιστροφή: ${voidReasonMeta[order.refundReason]}`
                : ""}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusChip status={order.status} />
          {order.refundReason && (
            <span className="bg-error-container text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
              ΕΠΙΣΤΡΟΦΗ
            </span>
          )}
          {mode === "active" && order.status !== "ready" && (
            <span className={cn("px-2 py-0.5 rounded-lg font-bold text-sm", ageChipClasses[age])}>
              {formatAge(order.sentAt, nowMs)}
            </span>
          )}
          <span className="text-xl font-bold text-primary">
            {formatPrice(order.totalCents)}
          </span>
        </div>
      </div>

      {isReady && (
        <div className="mt-3 text-center bg-primary text-on-primary rounded-lg py-2 font-bold animate-pulse">
          ΣΕΡΒΙΡΙΣΤΕ ΤΩΡΑ · SERVE NOW
        </div>
      )}
    </Link>
  );
}
