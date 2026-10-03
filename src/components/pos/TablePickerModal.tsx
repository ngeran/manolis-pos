"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useOrderStore, type SelectedTable } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { BoardOrder, DiningTable } from "@/lib/kitchen";

interface TablePickerModalProps {
  onClose: () => void;
}

/**
 * Pick where the order will be served: takeaway, a table, or a combination
 * of tables (tap a second table to merge — seats add up for bigger parties).
 * Shows live occupancy so staff can see which tables already have an order.
 */
export function TablePickerModal({ onClose }: TablePickerModalProps) {
  const setTableSelection = useOrderStore((s) => s.setTableSelection);
  const setGuests = useOrderStore((s) => s.setGuests);

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [active, setActive] = useState<BoardOrder[]>([]);
  const [pending, setPending] = useState<SelectedTable[]>(
    () => useOrderStore.getState().tables
  );
  const [pendingGuests, setPendingGuests] = useState<number | null>(
    () => useOrderStore.getState().guests
  );

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then(setTables)
      .catch(() => {});
    fetch("/api/orders?scope=active")
      .then((r) => r.json())
      .then((p) => setActive(p.orders ?? []))
      .catch(() => {});
  }, []);

  const occupiedByTable = new Map<string, BoardOrder>();
  for (const o of active) {
    const names = o.tableNames?.length ? o.tableNames : o.tableNumber ? [o.tableNumber] : [];
    for (const n of names) {
      if (!occupiedByTable.has(n)) occupiedByTable.set(n, o);
    }
  }

  const toggleTable = (t: DiningTable) => {
    setPending((prev) => {
      if (prev.some((p) => p.id === t.id)) {
        return prev.filter((p) => p.id !== t.id);
      }
      const next = [...prev, { id: t.id, name: t.name }];
      // Combined capacity = sum of seats; reset the party size to match.
      const seats = next.reduce(
        (sum, p) => sum + (tables.find((x) => x.id === p.id)?.seats ?? 0),
        0
      );
      setPendingGuests(seats > 0 ? seats : null);
      return next;
    });
  };

  const apply = () => {
    setTableSelection(pending);
    setGuests(pending.length ? pendingGuests : null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Πού θα σερβιριστεί;</h2>
            <p className="text-xs text-outline">
              Πατήστε δύο τραπέζια για να τα ενώσετε
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Takeaway */}
          <button
            onClick={() => setPending([])}
            className={cn(
              "w-full py-3 rounded-xl border-2 font-bold min-h-[52px] flex items-center justify-center gap-2 transition-colors",
              pending.length === 0
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface text-on-surface hover:border-primary-container"
            )}
          >
            <span className="material-symbols-outlined">takeout_dining</span>
            Takeaway
          </button>

          {/* Tables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-on-surface">Τραπέζια</p>
              {pending.length > 1 && (
                <span className="text-xs font-bold text-primary">
                  Ενωμένα: {pending.map((p) => p.name).join(" + ")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {tables.map((t) => {
                const occ = occupiedByTable.get(t.name);
                const selected = pending.some((p) => p.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTable(t)}
                    className={cn(
                      "rounded-xl border-2 p-2 flex flex-col items-center gap-0.5 min-h-[76px] justify-center transition-colors",
                      selected
                        ? "border-primary bg-primary-container/20"
                        : "border-outline-variant bg-surface hover:border-primary-container",
                      occ && !selected && "opacity-70"
                    )}
                  >
                    <span className="text-lg font-extrabold text-on-surface leading-none">
                      {t.name}
                    </span>
                    {t.nickname && (
                      <span className="text-[10px] font-semibold text-tertiary truncate max-w-full">
                        {t.nickname}
                      </span>
                    )}
                    {t.seats != null && (
                      <span className="text-[10px] text-outline">{t.seats} θέσεις</span>
                    )}
                    {occ && (
                      <span className="text-[10px] font-bold text-warning">
                        ανοιχτό #{occ.dailyNumber}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {tables.length === 0 && (
              <p className="text-xs text-outline">
                Δεν έχουν οριστεί τραπέζια — θα εμφανίζεται Takeaway.
              </p>
            )}
          </div>

          {/* Party size */}
          {pending.length > 0 && (
            <div className="flex items-center justify-between bg-surface-container-low rounded-xl p-3">
              <span className="text-sm font-semibold text-on-surface">
                Άτομα
                {pending.length > 1 && (
                  <span className="text-outline font-normal"> (ενωμένα τραπέζια)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPendingGuests((g) => (g === null ? 1 : Math.max(1, g - 1)))
                  }
                  className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high min-h-[44px] min-w-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span className="font-bold text-lg min-w-[40px] text-center text-on-surface">
                  {pendingGuests ?? "—"}
                </span>
                <button
                  onClick={() => setPendingGuests((g) => Math.min(30, (g ?? 0) + 1))}
                  className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high min-h-[44px] min-w-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-outline-variant flex justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            Κλείσιμο
          </Button>
          <Button variant="primary" size="md" onClick={apply}>
            Έτοιμο
          </Button>
        </div>
      </div>
    </div>
  );
}
