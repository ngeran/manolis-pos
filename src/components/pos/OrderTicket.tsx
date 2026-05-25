"use client";

import { useOrderStore } from "@/lib/store";
import { formatPrice, formatWeight, calculateLineTotal } from "@/lib/utils";
import { QuantityStepper } from "./QuantityStepper";
import { Button } from "@/components/ui/Button";

interface OrderTicketProps {
  onSubmit: () => void;
  submitting?: boolean;
}

export function OrderTicket({ onSubmit, submitting }: OrderTicketProps) {
  const { items, removeItem, updateQuantityGrams, updateNotes, clearCart, subtotalCents, taxCents, totalCents, itemCount } =
    useOrderStore();

  if (items.length === 0) {
    return (
      <aside className="w-[340px] bg-surface border-l border-outline-variant flex flex-col">
        <div className="p-6 border-b border-outline-variant bg-surface-container-low">
          <h2 className="text-2xl font-bold text-on-surface">Current Order</h2>
        </div>
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="text-center text-outline">
            <span className="material-symbols-outlined text-[48px] mb-3 block">
              shopping_cart
            </span>
            <p className="text-sm">No items yet</p>
            <p className="text-xs mt-1">Tap items to add them</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] bg-surface border-l border-outline-variant flex flex-col">
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <h2 className="text-2xl font-bold text-on-surface">Current Order</h2>
        <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-bold text-xs">
          {itemCount()} Items
        </span>
      </div>

      <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.menuItemId}
            className="flex flex-col gap-1 p-3 bg-surface rounded-xl border border-outline-variant hover:border-primary-container transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-normal text-base text-on-surface">
                  {item.name}
                </h4>
                {item.notes && (
                  <span className="text-xs font-medium text-tertiary">
                    {item.notes}
                  </span>
                )}
              </div>
              <span className="font-bold text-on-surface">
                {formatPrice(calculateLineTotal(item.priceCents, item.quantityGrams))}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              {item.pricingType === "unit" ? (
                <QuantityStepper
                  quantity={item.quantityGrams / 1000}
                  onIncrement={() =>
                    updateQuantityGrams(item.menuItemId, item.quantityGrams + 1000)
                  }
                  onDecrement={() =>
                    updateQuantityGrams(item.menuItemId, item.quantityGrams - 1000)
                  }
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{formatWeight(item.quantityGrams)}</span>
                  <button
                    onClick={() => updateQuantityGrams(item.menuItemId, item.quantityGrams - 250)}
                    className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors min-h-[48px] min-w-[48px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <button
                    onClick={() => updateQuantityGrams(item.menuItemId, item.quantityGrams + 250)}
                    className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors min-h-[48px] min-w-[48px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const notes = prompt("Notes for this item:", item.notes ?? "");
                    if (notes !== null) updateNotes(item.menuItemId, notes);
                  }}
                  className="text-outline hover:bg-surface-container-high p-1 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                  title="Add notes"
                >
                  <span className="material-symbols-outlined">edit_note</span>
                </button>
                <button
                  onClick={() => removeItem(item.menuItemId)}
                  className="text-error hover:bg-error-container/10 p-1 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-outline-variant bg-surface mt-auto">
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm font-semibold text-outline">
            <span>Subtotal</span>
            <span>{formatPrice(subtotalCents())}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-outline">
            <span>Tax (13%)</span>
            <span>{formatPrice(taxCents())}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-on-surface pt-3 border-t border-outline-variant">
            <span>Total</span>
            <span className="text-primary">{formatPrice(totalCents())}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="md" onClick={clearCart} className="flex-shrink-0">
            Clear
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onSubmit}
            disabled={submitting}
            className="flex-grow"
          >
            <span className="material-symbols-outlined text-[28px]">
              restaurant_menu
            </span>{" "}
            {submitting ? "Sending..." : "Send to Kitchen"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
