"use client";

import { useState } from "react";
import { useOrderStore, type CartItem } from "@/lib/store";
import { formatPrice, formatWeight, calculateLineTotal, cn } from "@/lib/utils";
import { guestsLabel, tableSelectionLabel } from "@/lib/kitchen";
import { QuantityStepper } from "./QuantityStepper";
import { NoteModal } from "./NoteModal";
import { Button } from "@/components/ui/Button";

interface OrderTicketProps {
  onSubmit: () => void;
  submitting?: boolean;
  /** True while appending a round to an existing live order. */
  appendMode?: boolean;
  /** Opens the table/party picker (omitted in append mode). */
  onOpenPicker?: () => void;
}

/**
 * Desktop order ticket — dense by design: compact rows so the whole
 * order is visible without scrolling.
 */
export function OrderTicket({ onSubmit, submitting, appendMode, onOpenPicker }: OrderTicketProps) {
  const {
    items,
    removeItem,
    updateQuantityGrams,
    updateNotes,
    updateHold,
    clearCart,
    totalCents,
    itemCount,
    tables,
    guests,
  } = useOrderStore();
  const [editingNotesFor, setEditingNotesFor] = useState<CartItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const tableLabel = tables.length ? tableSelectionLabel(tables) : "";

  if (items.length === 0) {
    return (
      <aside className="w-[300px] lg:w-[340px] bg-surface border-l border-outline-variant flex flex-col">
        <div className="p-4 border-b border-outline-variant bg-surface-container-low">
          <h2 className="text-lg font-bold text-on-surface">Παραγγελία</h2>
        </div>
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="text-center text-outline">
            <span className="material-symbols-outlined text-[40px] mb-2 block">
              shopping_cart
            </span>
            <p className="text-sm">Κενή παραγγελία</p>
            <p className="text-xs mt-1">Πατήστε προϊόντα για προσθήκη</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside className="w-[300px] lg:w-[340px] bg-surface border-l border-outline-variant flex flex-col">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h2 className="text-lg font-bold text-on-surface">Παραγγελία</h2>
          <span className="bg-primary-container text-on-primary-container px-2.5 py-0.5 rounded-full font-bold text-xs">
            {itemCount()}
          </span>
        </div>

        {/* Destination */}
        {onOpenPicker && !appendMode && (
          <button
            onClick={onOpenPicker}
            className="w-full px-4 py-2 border-b border-outline-variant flex items-center justify-between hover:bg-surface-container-low min-h-[40px]"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-outline min-w-0">
              <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                {tables.length ? "table_restaurant" : "takeout_dining"}
              </span>
              <span className="truncate">
                {tables.length ? `Τραπέζι ${tableLabel}` : "Takeaway"}
                {guestsLabel(guests) && ` · ${guestsLabel(guests)}`}
              </span>
            </span>
            <span className="text-[11px] font-bold text-primary shrink-0">Αλλαγή</span>
          </button>
        )}

        {/* Items — compact rows */}
        <div className="flex-grow overflow-y-auto px-4">
          {items.map((item) => (
            <div key={item.menuItemId} className="py-1.5 border-b border-outline-variant/40 last:border-0">
              <div className="flex items-center gap-1.5">
                {item.pricingType === "unit" ? (
                  <QuantityStepper
                    compact
                    quantity={item.quantityGrams / 1000}
                    onIncrement={() =>
                      updateQuantityGrams(item.menuItemId, item.quantityGrams + 1000)
                    }
                    onDecrement={() =>
                      updateQuantityGrams(item.menuItemId, item.quantityGrams - 1000)
                    }
                  />
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => updateQuantityGrams(item.menuItemId, item.quantityGrams - 250)}
                      className="w-7 h-7 min-h-[30px] min-w-[30px] flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span className="text-xs font-bold min-w-[48px] text-center">
                      {formatWeight(item.quantityGrams)}
                    </span>
                    <button
                      onClick={() => updateQuantityGrams(item.menuItemId, item.quantityGrams + 250)}
                      className="w-7 h-7 min-h-[30px] min-w-[30px] flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-medium text-on-surface truncate block leading-tight",
                      item.hold && "text-secondary"
                    )}
                  >
                    {item.name}
                  </span>
                  {(item.notes || item.hold) && (
                    <span className="text-[10px] text-tertiary truncate block leading-tight">
                      {item.hold && "Αναμονή"}
                      {item.hold && item.notes ? " · " : ""}
                      {item.notes}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-on-surface shrink-0">
                  {formatPrice(calculateLineTotal(item.priceCents, item.quantityGrams))}
                </span>
                <button
                  onClick={() =>
                    setExpanded((prev) => (prev === item.menuItemId ? null : item.menuItemId))
                  }
                  className={cn(
                    "shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors",
                    expanded === item.menuItemId
                      ? "text-on-surface bg-surface-container-high"
                      : "text-outline hover:text-on-surface"
                  )}
                  title="Επιλογές"
                >
                  <span className="material-symbols-outlined text-[16px]">more_vert</span>
                </button>
              </div>

              {expanded === item.menuItemId && (
                <div className="flex items-center gap-1 pt-1.5">
                  <button
                    onClick={() => setEditingNotesFor(item)}
                    className="flex items-center gap-1 text-xs font-semibold text-outline hover:text-on-surface border border-outline-variant rounded-md px-2 min-h-[30px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    Σημειώσεις
                  </button>
                  <button
                    onClick={() => updateHold(item.menuItemId, !(item.hold ?? false))}
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold rounded-md px-2 min-h-[30px] border",
                      item.hold
                        ? "text-secondary bg-secondary-container/40 border-secondary"
                        : "text-outline hover:text-on-surface border-outline-variant"
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Αναμονή
                  </button>
                  <button
                    onClick={() => {
                      removeItem(item.menuItemId);
                      setExpanded(null);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-error hover:bg-error-container/10 rounded-md px-2 min-h-[30px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Διαγραφή
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pt-2 pb-4 border-t border-outline-variant bg-surface">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-outline">
              Σύνολο
              <span className="block text-[10px] font-normal">με ΦΠΑ</span>
            </span>
            <span className="text-xl font-extrabold text-primary">
              {formatPrice(totalCents())}
            </span>
          </div>
          {appendMode && (
            <p className="text-[10px] font-semibold text-outline">
              Νέα είδη μόνο — το σύνολο ενημερώνεται αυτόματα
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={clearCart}
              disabled={submitting}
              className="px-3 min-h-[44px] rounded-lg text-sm font-semibold text-outline border border-outline-variant hover:bg-surface-container-high disabled:opacity-50 shrink-0"
              title="Άδειασμα"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
            <Button
              variant="primary"
              size="md"
              onClick={onSubmit}
              disabled={submitting}
              className="flex-grow"
            >
              <span className="material-symbols-outlined text-[20px]">restaurant_menu</span>
              {submitting
                ? "Αποστολή…"
                : appendMode
                  ? "Προσθήκη"
                  : "Αποστολή στην Κουζίνα"}
            </Button>
          </div>
        </div>
      </aside>

      {editingNotesFor && (
        <NoteModal
          itemName={editingNotesFor.name}
          initialNotes={editingNotesFor.notes ?? ""}
          onConfirm={(notes) => {
            updateNotes(editingNotesFor.menuItemId, notes);
            setEditingNotesFor(null);
          }}
          onCancel={() => setEditingNotesFor(null)}
        />
      )}
    </>
  );
}
