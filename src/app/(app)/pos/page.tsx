"use client";

import { useEffect, useState } from "react";
import { MenuGrid, MenuItemData } from "@/components/pos/MenuGrid";
import { OrderTicket } from "@/components/pos/OrderTicket";
import { WeightPickerModal } from "@/components/pos/WeightPickerModal";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { NoteModal } from "@/components/pos/NoteModal";
import { TablePickerModal } from "@/components/pos/TablePickerModal";
import { useOrderStore, type CartItem } from "@/lib/store";
import { formatPrice, formatWeight, cn } from "@/lib/utils";
import { guestsLabel, tableSelectionLabel } from "@/lib/kitchen";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

function tickHaptic() {
  // Subtle confirmation on devices that support it (Android); silent elsewhere.
  navigator.vibrate?.(10);
}

export default function POSPage() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameEl: string; nameEn: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [weightPickerItem, setWeightPickerItem] = useState<MenuItemData | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<CartItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addItem = useOrderStore((s) => s.addItem);
  const cartItems = useOrderStore((s) => s.items);
  const totalCents = useOrderStore((s) => s.totalCents);
  const tables = useOrderStore((s) => s.tables);
  const guests = useOrderStore((s) => s.guests);
  const guestName = useOrderStore((s) => s.guestName);
  const takeawayChosen = useOrderStore((s) => s.takeawayChosen);
  const reservationId = useOrderStore((s) => s.reservationId);
  const clearCart = useOrderStore((s) => s.clearCart);
  const editOrderId = useOrderStore((s) => s.editOrderId);
  const editOrderLabel = useOrderStore((s) => s.editOrderLabel);
  const stopEditOrder = useOrderStore((s) => s.stopEditOrder);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/menu").then((r) => {
        if (!r.ok) throw new Error(`Menu API: ${r.status}`);
        return r.json();
      }),
      fetch("/api/categories").then((r) => {
        if (!r.ok) throw new Error(`Categories API: ${r.status}`);
        return r.json();
      }),
    ]).then(([menuItems, cats]) => {
      setItems(menuItems);
      setCategories(cats);
    }).catch((err) => {
      console.error("Failed to load menu data:", err);
    });
  }, []);

  const handleAddItem = (item: MenuItemData) => {
    if (item.pricingType === "weight") {
      setWeightPickerItem(item);
    } else {
      addItem({
        menuItemId: item.id,
        name: item.nameEl,
        priceCents: item.priceCents,
        pricingType: "unit",
        quantityGrams: 1000,
      });
      tickHaptic();
    }
  };

  const handleWeightConfirm = (grams: number) => {
    if (!weightPickerItem) return;
    addItem({
      menuItemId: weightPickerItem.id,
      name: weightPickerItem.nameEl,
      priceCents: weightPickerItem.priceCents,
      pricingType: "weight",
      quantityGrams: grams,
    });
    tickHaptic();
    setWeightPickerItem(null);
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    // Order type is an explicit choice: never send with a silent Takeaway default.
    if (!editOrderId && !takeawayChosen && tables.length === 0) {
      setSubmitError("Επιλέξτε πρώτα προορισμό: τραπέζι ή Takeaway");
      setPickerOpen(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: tables.length ? tableSelectionLabel(tables) : undefined,
          tableIds: tables.length ? tables.map((t) => t.id) : undefined,
          guests: guests ?? undefined,
          guestName: guestName || undefined,
          reservationId: !editOrderId ? reservationId || undefined : undefined,
          orderId: editOrderId || undefined,
          items: cartItems.map((i) => ({
            menuItemId: i.menuItemId,
            quantityGrams: i.quantityGrams,
            notes: i.notes,
            hold: i.hold ?? false,
          })),
        }),
      });

      if (res.ok) {
        const target = editOrderId ? `/orders/${editOrderId}` : "/orders";
        clearCart();
        setMobileCartOpen(false);
        router.push(target);
      } else {
        const err = await res.json().catch(() => null);
        setSubmitError(
          typeof err?.error === "string" ? err.error : "Failed to submit order"
        );
        // Appending to an order that was closed meanwhile — exit edit mode.
        if (res.status === 409) stopEditOrder();
      }
    } catch {
      setSubmitError("Network error — check the connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Append-mode banner */}
      {editOrderId && (
        <div className="bg-secondary text-on-secondary px-4 py-1.5 flex items-center justify-between gap-3 shrink-0">
          <span className="text-sm font-bold truncate">
            Προσθήκη σε {editOrderLabel}
          </span>
          <button
            onClick={stopEditOrder}
            className="text-xs font-bold underline underline-offset-2 min-h-[44px] px-2 shrink-0"
          >
            Έξοδος
          </button>
        </div>
      )}

      {/* Menu area: full width on mobile, flexible on desktop.
          min-w-0 lets the panel shrink below the chips row's intrinsic
          width — without it the grid overflows horizontally on phones. */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
        <MenuGrid
          items={items}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categories={categories}
          onAddItem={handleAddItem}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          headerSlot={
            !editOrderId ? (
              <button
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "w-full sm:w-72 shrink-0 flex items-center justify-between bg-surface-container-low border rounded-full px-4 py-2 min-h-[44px] hover:border-primary-container transition-colors",
                  tables.length > 0 || takeawayChosen
                    ? "border-outline-variant"
                    : "border-dashed border-warning"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-on-surface min-w-0">
                  <span
                    className={cn(
                      "material-symbols-outlined text-[18px] shrink-0",
                      tables.length > 0 || takeawayChosen ? "text-primary" : "text-warning"
                    )}
                  >
                    {tables.length ? "table_restaurant" : takeawayChosen ? "takeout_dining" : "help"}
                  </span>
                  <span className="truncate">
                    {tables.length
                      ? `Τραπέζι ${tableSelectionLabel(tables)}`
                      : takeawayChosen
                        ? "Takeaway"
                        : "Επιλέξτε προορισμό"}
                    {guestName && <span> · {guestName}</span>}
                    {guestsLabel(guests) && (
                      <span className="text-outline font-semibold">
                        {" "}
                        · {guestsLabel(guests)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-xs font-bold text-primary shrink-0">Αλλαγή</span>
              </button>
            ) : null
          }
        />
      </div>

      {/* Tablet/desktop: sidebar order ticket */}
      <div className="hidden md:flex">
        <OrderTicket
          onSubmit={handleSubmit}
          submitting={submitting}
          appendMode={!!editOrderId}
          onOpenPicker={editOrderId ? undefined : () => setPickerOpen(true)}
        />
      </div>

      {/* Phone: floating cart button + bottom drawer */}
      {cartItems.length > 0 && (
        <div className="md:hidden">
          {/* Floating cart button */}
          {!mobileCartOpen && (
            <button
              onClick={() => setMobileCartOpen(true)}
              className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-30 bg-primary text-on-primary rounded-2xl px-5 py-4 shadow-lg flex items-center gap-3 min-h-[56px] font-bold text-base"
            >
              <span className="material-symbols-outlined">shopping_cart</span>
              <span>{cartItems.length}</span>
              <span className="border-l border-on-primary/30 pl-3">{formatPrice(totalCents())}</span>
            </button>
          )}

          {/* Bottom sheet overlay */}
          {mobileCartOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileCartOpen(false)}
            />
          )}

          {/* Bottom sheet */}
          <div
            className={`fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-outline-variant transition-transform duration-300 pb-[env(safe-area-inset-bottom)] max-h-[85dvh] ${
              mobileCartOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex flex-col max-h-[85dvh]">
              {/* Drag handle + header */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-outline-variant" />
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-b border-outline-variant">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-on-surface">Παραγγελία</h2>
                  <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-bold text-xs">
                    {cartItems.length}
                  </span>
                </div>
                <button
                  onClick={() => setMobileCartOpen(false)}
                  className="text-outline hover:bg-surface-container-high p-1 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Cart items - scrollable */}
              <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
                {cartItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-base text-on-surface truncate">
                          {item.name}
                          {item.hold && (
                            <span className="text-secondary text-xs font-bold ml-2">
                              · Αναμονή
                            </span>
                          )}
                        </h4>
                        {item.notes && (
                          <span className="text-xs font-medium text-tertiary">{item.notes}</span>
                        )}
                      </div>
                      <span className="font-bold text-on-surface shrink-0">
                        {formatPrice(Math.round((item.priceCents * item.quantityGrams) / 1000))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {item.pricingType === "unit" ? (
                        <QuantityStepper
                          quantity={item.quantityGrams / 1000}
                          onIncrement={() => {
                            useOrderStore.getState().updateQuantityGrams(item.menuItemId, item.quantityGrams + 1000);
                            tickHaptic();
                          }}
                          onDecrement={() => {
                            useOrderStore.getState().updateQuantityGrams(item.menuItemId, item.quantityGrams - 1000);
                            tickHaptic();
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              useOrderStore.getState().updateQuantityGrams(item.menuItemId, item.quantityGrams - 250);
                              tickHaptic();
                            }}
                            className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high min-h-[44px] min-w-[44px]"
                          >
                            <span className="material-symbols-outlined text-[18px]">remove</span>
                          </button>
                          <span className="font-bold text-sm min-w-[56px] text-center">
                            {formatWeight(item.quantityGrams)}
                          </span>
                          <button
                            onClick={() => {
                              useOrderStore.getState().updateQuantityGrams(item.menuItemId, item.quantityGrams + 250);
                              tickHaptic();
                            }}
                            className="flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high min-h-[44px] min-w-[44px]"
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setEditingNotes(item)}
                          className={cn(
                            "p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center",
                            item.notes ? "text-tertiary" : "text-outline hover:bg-surface-container-high"
                          )}
                          title="Σημειώσεις"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit_note</span>
                        </button>
                        <button
                          onClick={() =>
                            useOrderStore.getState().updateHold(item.menuItemId, !(item.hold ?? false))
                          }
                          className={cn(
                            "p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center",
                            item.hold ? "text-secondary bg-secondary-container/40" : "text-outline"
                          )}
                          title={item.hold ? "Κρατάμε — δεν στέλνεται ακόμα στην κουζίνα" : "Κράτα για αργότερα (hold)"}
                        >
                          <span className="material-symbols-outlined text-[20px]">schedule</span>
                        </button>
                        <button
                          onClick={() => useOrderStore.getState().removeItem(item.menuItemId)}
                          className="text-error p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary + submit */}
              <div className="p-4 border-t border-outline-variant bg-surface">
                {!editOrderId && (
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-between min-h-[40px] mb-2"
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold min-w-0",
                        tables.length > 0 || takeawayChosen ? "text-on-surface" : "text-warning"
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                        {tables.length
                          ? "table_restaurant"
                          : takeawayChosen
                            ? "takeout_dining"
                            : "help"}
                      </span>
                      <span className="truncate">
                        {tables.length
                          ? `Τραπέζι ${tableSelectionLabel(tables)}`
                          : takeawayChosen
                            ? "Takeaway"
                            : "Επιλέξτε προορισμό"}
                        {guestName && <span> · {guestName}</span>}
                        {guestsLabel(guests) && <span> · {guestsLabel(guests)}</span>}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-primary shrink-0">Αλλαγή</span>
                  </button>
                )}
                <div className="flex justify-between text-2xl font-bold text-on-surface mb-4">
                  <span>Σύνολο</span>
                  <span className="text-primary">{formatPrice(totalCents())}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      useOrderStore.getState().clearCart();
                      setMobileCartOpen(false);
                    }}
                    className="px-4 py-3 rounded-lg font-semibold text-sm border border-outline-variant text-on-surface hover:bg-surface-container-high min-h-[48px]"
                  >
                    Άδειασμα
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-grow bg-primary text-on-primary py-3 rounded-lg font-bold text-base hover:bg-primary-container min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
                    {submitting ? "Αποστολή…" : "Αποστολή στην Κουζίνα"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {weightPickerItem && (
        <WeightPickerModal
          item={weightPickerItem}
          onConfirm={handleWeightConfirm}
          onCancel={() => setWeightPickerItem(null)}
        />
      )}

      {editingNotes && (
        <NoteModal
          itemName={editingNotes.name}
          initialNotes={editingNotes.notes ?? ""}
          onConfirm={(notes) => {
            useOrderStore.getState().updateNotes(editingNotes.menuItemId, notes);
            setEditingNotes(null);
          }}
          onCancel={() => setEditingNotes(null)}
        />
      )}

      {pickerOpen && <TablePickerModal onClose={() => setPickerOpen(false)} />}

      {submitError && (
        <div
          role="alert"
          className="fixed left-1/2 -translate-x-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-[60] bg-error-container text-on-error-container pl-4 pr-2 py-2 rounded-xl shadow-lg flex items-center gap-2 max-w-[calc(100vw-2rem)]"
        >
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span className="text-sm font-semibold">{submitError}</span>
          <button
            onClick={() => setSubmitError(null)}
            className="p-2 rounded-lg hover:bg-on-error-container/10 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}
    </>
  );
}
