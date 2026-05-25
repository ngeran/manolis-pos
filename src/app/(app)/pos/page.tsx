"use client";

import { useEffect, useState } from "react";
import { MenuGrid, MenuItemData } from "@/components/pos/MenuGrid";
import { OrderTicket } from "@/components/pos/OrderTicket";
import { WeightPickerModal } from "@/components/pos/WeightPickerModal";
import { useOrderStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function POSPage() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameEl: string; nameEn: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [weightPickerItem, setWeightPickerItem] = useState<MenuItemData | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const addItem = useOrderStore((s) => s.addItem);
  const cartItems = useOrderStore((s) => s.items);
  const totalCents = useOrderStore((s) => s.totalCents);
  const tableNumber = useOrderStore((s) => s.tableNumber);
  const clearCart = useOrderStore((s) => s.clearCart);
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
    setWeightPickerItem(null);
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: tableNumber || undefined,
          items: cartItems.map((i) => ({
            menuItemId: i.menuItemId,
            quantityGrams: i.quantityGrams,
            notes: i.notes,
          })),
        }),
      });

      if (res.ok) {
        clearCart();
        router.push("/orders");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit order");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Menu area: full width on mobile, flexible on desktop */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <MenuGrid
          items={items}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categories={categories}
          onAddItem={handleAddItem}
        />
      </div>

      {/* Desktop: sidebar order ticket */}
      <div className="hidden lg:flex">
        <OrderTicket onSubmit={handleSubmit} submitting={submitting} />
      </div>

      {/* Mobile: floating cart button + bottom drawer */}
      {cartItems.length > 0 && (
        <div className="lg:hidden">
          {/* Floating cart button */}
          {!mobileCartOpen && (
            <button
              onClick={() => setMobileCartOpen(true)}
              className="fixed bottom-6 right-6 z-30 bg-primary text-on-primary rounded-2xl px-5 py-4 shadow-lg flex items-center gap-3 min-h-[56px] font-bold text-base"
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
            className={`fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-outline-variant transition-transform duration-300 ${
              mobileCartOpen ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ maxHeight: "85vh" }}
          >
            <div className="flex flex-col" style={{ maxHeight: "85vh" }}>
              {/* Drag handle + header */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-outline-variant" />
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-b border-outline-variant">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-on-surface">Current Order</h2>
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
                    className="flex justify-between items-start p-3 bg-surface-container-low rounded-xl border border-outline-variant"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base text-on-surface truncate">{item.name}</h4>
                      {item.notes && (
                        <span className="text-xs font-medium text-tertiary">{item.notes}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <span className="font-bold text-on-surface">
                        {formatPrice(Math.round((item.priceCents * item.quantityGrams) / 1000))}
                      </span>
                      <button
                        onClick={() => useOrderStore.getState().removeItem(item.menuItemId)}
                        className="text-error p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary + submit */}
              <div className="p-4 border-t border-outline-variant bg-surface">
                <div className="flex justify-between text-2xl font-bold text-on-surface mb-4">
                  <span>Total</span>
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
                    Clear
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-grow bg-primary text-on-primary py-3 rounded-lg font-bold text-base hover:bg-primary-container min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
                    {submitting ? "Sending..." : "Send to Kitchen"}
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
    </>
  );
}
