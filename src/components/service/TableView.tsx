"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { useOrderStore } from "@/lib/store";
import { StatusChip } from "./StatusChip";
import { formatPrice, cn } from "@/lib/utils";
import { ageClass, ageChipClasses, formatAge } from "@/lib/kitchen";
import type { BoardOrder, DiningTable } from "@/lib/kitchen";

/**
 * Floor-plan view of the dining room: every known table is a tile —
 * dashed when free (tap to start a new order there), solid when occupied.
 * Takeaway and unknown-table orders get tiles below the grid.
 */
export function TableView({ orders, nowMs }: { orders: BoardOrder[]; nowMs: number }) {
  const { data: tables } = usePolling<DiningTable[]>("/api/tables", { intervalMs: 30000 });
  const router = useRouter();

  const { byTable, takeaways } = useMemo(() => {
    const byTable = new Map<string, BoardOrder[]>();
    const takeaways: BoardOrder[] = [];
    for (const o of orders) {
      if (o.tableNumber) {
        const list = byTable.get(o.tableNumber) ?? [];
        list.push(o);
        byTable.set(o.tableNumber, list);
      } else {
        takeaways.push(o);
      }
    }
    return { byTable, takeaways };
  }, [orders]);

  const startAt = (name: string) => {
    useOrderStore.getState().setTableNumber(name);
    router.push("/pos");
  };

  const allTables = tables ?? [];
  const knownNames = new Set(allTables.map((t) => t.name));
  const unmatched = [...byTable.keys()].filter((n) => !knownNames.has(n));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {allTables.map((t) => {
          const ordersAt = byTable.get(t.name);
          if (!ordersAt || ordersAt.length === 0) {
            return (
              <FreeTile
                key={t.id}
                name={t.name}
                seats={t.seats}
                onStart={() => startAt(t.name)}
              />
            );
          }
          return <OccupiedTile key={t.id} label={t.name} orders={ordersAt} nowMs={nowMs} />;
        })}

        {takeaways.map((o) => (
          <OccupiedTile key={o.id} label="Takeaway" orders={[o]} nowMs={nowMs} />
        ))}
        {unmatched.map((name) => (
          <OccupiedTile key={name} label={name} orders={byTable.get(name)!} nowMs={nowMs} />
        ))}
      </div>

      {allTables.length === 0 && (
        <p className="text-sm text-outline">
          Δεν έχουν οριστεί τραπέζια — προσθέστε από Tables (μενού διαχείρισης).
        </p>
      )}
    </div>
  );
}

function FreeTile({
  name,
  seats,
  onStart,
}: {
  name: string;
  seats: number | null;
  onStart: () => void;
}) {
  return (
    <button
      onClick={onStart}
      className="min-h-[124px] rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary-container/10 flex flex-col items-center justify-center gap-1 transition-colors"
    >
      <span className="text-2xl font-extrabold text-outline">{name}</span>
      {seats != null && (
        <span className="text-xs text-outline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">event_seat</span>
          {seats} θέσεις
        </span>
      )}
      <span className="text-xs font-bold text-primary flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">add_circle</span>
        Νέα παραγγελία
      </span>
    </button>
  );
}

function OccupiedTile({
  label,
  orders,
  nowMs,
}: {
  label: string;
  orders: BoardOrder[];
  nowMs: number;
}) {
  const o = orders[0];
  const isReady = o.status === "ready";
  const age = ageClass(o.sentAt, nowMs);

  return (
    <Link
      href={`/orders/${o.id}`}
      className={cn(
        "min-h-[124px] rounded-xl border-2 p-3 flex flex-col justify-between gap-1.5 transition-colors",
        isReady
          ? "border-primary bg-primary-container/20"
          : o.priority
            ? "border-error bg-surface"
            : "border-outline-variant bg-surface hover:border-primary-container"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl font-extrabold text-on-surface leading-none">
          {label}
        </span>
        {o.priority ? (
          <span className="bg-error text-on-error px-1.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse shrink-0">
            ΠΡΟΤΕΡΑΙΟΤΗΤΑ
          </span>
        ) : (
          o.status !== "ready" && (
            <span
              className={cn("px-2 py-0.5 rounded-lg font-bold text-sm", ageChipClasses[age])}
            >
              {formatAge(o.sentAt, nowMs)}
            </span>
          )
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-outline">
            #{o.dailyNumber} · {o.doneCount}/{o.itemCount} είδη
          </span>
          <span className="text-sm font-bold text-primary">
            {formatPrice(o.totalCents)}
          </span>
        </div>
        {isReady ? (
          <div className="text-center bg-primary text-on-primary rounded-lg py-1 text-xs font-bold animate-pulse">
            ΣΕΡΒΙΡΙΣΤΕ
          </div>
        ) : (
          <StatusChip status={o.status} />
        )}
        {orders.length > 1 && (
          <span className="text-xs font-bold text-tertiary">
            +{orders.length - 1} ακόμη παραγγελίες
          </span>
        )}
      </div>
    </Link>
  );
}
