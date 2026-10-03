"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { useOrderStore } from "@/lib/store";
import { StatusChip } from "./StatusChip";
import { formatPrice, cn } from "@/lib/utils";
import { ageClass, ageChipClasses, formatAge, guestsLabel } from "@/lib/kitchen";
import type { BoardOrder, DiningTable } from "@/lib/kitchen";

/**
 * Floor-plan view of the dining room: every known table is a tile —
 * dashed when free (tap to start a new order there), solid when occupied.
 * Combined tables (one order occupying several) mark every member tile.
 * Takeaway and unknown-table orders get tiles below the grid.
 */
export function TableView({ orders, nowMs }: { orders: BoardOrder[]; nowMs: number }) {
  const { data: tables } = usePolling<DiningTable[]>("/api/tables", { intervalMs: 30000 });
  const router = useRouter();

  const { occupied, takeaways, unmatched } = useMemo(() => {
    const occupied = new Map<string, { order: BoardOrder; combined: string[] }>();
    const takeaways: BoardOrder[] = [];
    const unmatched = new Map<string, BoardOrder[]>();
    const known = new Set((tables ?? []).map((t) => t.name));

    for (const o of orders) {
      const names = o.tableNames?.length
        ? o.tableNames
        : o.tableNumber
          ? [o.tableNumber]
          : [];
      if (names.length === 0) {
        takeaways.push(o);
        continue;
      }
      for (const n of names) {
        if (known.has(n)) {
          if (!occupied.has(n)) occupied.set(n, { order: o, combined: names });
        } else {
          const list = unmatched.get(n) ?? [];
          if (!list.some((x) => x.id === o.id)) list.push(o);
          unmatched.set(n, list);
        }
      }
    }
    return { occupied, takeaways, unmatched };
  }, [orders, tables]);

  const startAt = (t: DiningTable) => {
    useOrderStore.getState().setTableSelection([{ id: t.id, name: t.name }]);
    router.push("/pos");
  };

  if (!tables) {
    return <div className="py-10 text-center text-outline text-sm">Φόρτωση τραπεζιών…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {tables.map((t) => {
          const occ = occupied.get(t.name);
          if (!occ) {
            return <FreeTile key={t.id} table={t} onStart={() => startAt(t)} />;
          }
          const combinedWith = occ.combined.filter((n) => n !== t.name);
          return (
            <OccupiedTile
              key={t.id}
              label={t.name}
              nickname={t.nickname}
              combinedWith={combinedWith}
              orders={[occ.order]}
              nowMs={nowMs}
            />
          );
        })}

        {takeaways.map((o) => (
          <OccupiedTile key={o.id} label="Takeaway" orders={[o]} nowMs={nowMs} />
        ))}
        {[...unmatched.entries()].map(([name, os]) => (
          <OccupiedTile key={name} label={name} orders={os} nowMs={nowMs} />
        ))}
      </div>

      {tables.length === 0 && (
        <p className="text-sm text-outline">
          Δεν έχουν οριστεί τραπέζια — προσθέστε από Tables (μενού διαχείρισης).
        </p>
      )}
    </div>
  );
}

function FreeTile({
  table,
  onStart,
}: {
  table: DiningTable;
  onStart: () => void;
}) {
  return (
    <button
      onClick={onStart}
      className="min-h-[124px] rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary-container/10 flex flex-col items-center justify-center gap-0.5 transition-colors p-2"
    >
      <span className="text-2xl font-extrabold text-outline leading-none">
        {table.name}
      </span>
      {table.nickname && (
        <span className="text-xs font-semibold text-outline truncate max-w-full">
          {table.nickname}
        </span>
      )}
      {table.seats != null && (
        <span className="text-xs text-outline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">event_seat</span>
          {table.seats} θέσεις
        </span>
      )}
      <span className="text-xs font-bold text-primary flex items-center gap-1 mt-0.5">
        <span className="material-symbols-outlined text-[16px]">add_circle</span>
        Νέα παραγγελία
      </span>
    </button>
  );
}

function OccupiedTile({
  label,
  nickname,
  combinedWith,
  orders,
  nowMs,
}: {
  label: string;
  nickname?: string | null;
  combinedWith?: string[];
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
        <div className="min-w-0">
          <span className="text-xl font-extrabold text-on-surface leading-none">
            {label}
          </span>
          {nickname && (
            <span className="block text-[11px] font-semibold text-outline truncate">
              {nickname}
            </span>
          )}
          {combinedWith && combinedWith.length > 0 && (
            <span className="block text-[10px] font-semibold text-tertiary">
              ενωμένο με {combinedWith.join(", ")}
            </span>
          )}
        </div>
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
          <span className="text-xs font-semibold text-outline truncate">
            #{o.dailyNumber}
            {guestsLabel(o.guests) && ` · ${guestsLabel(o.guests)}`}
            {` · ${o.doneCount}/${o.itemCount}`}
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
