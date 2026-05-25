import { create } from "zustand";

export interface CartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
  pricingType: "unit" | "weight";
  quantityGrams: number;
  notes?: string;
}

interface OrderState {
  tableNumber: string;
  items: CartItem[];
  setTableNumber: (table: string) => void;
  addItem: (item: Omit<CartItem, "quantityGrams"> & { quantityGrams: number }) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantityGrams: (menuItemId: string, grams: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
  clearCart: () => void;
  itemCount: () => number;
  subtotalCents: () => number;
  taxCents: () => number;
  totalCents: () => number;
}

const TAX_RATE = 0.13;

export const useOrderStore = create<OrderState>((set, get) => ({
  tableNumber: "",
  items: [],

  setTableNumber: (table) => set({ tableNumber: table }),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItemId === item.menuItemId
              ? { ...i, quantityGrams: i.quantityGrams + item.quantityGrams }
              : i
          ),
        };
      }
      return { items: [...state.items, item] };
    }),

  removeItem: (menuItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.menuItemId !== menuItemId),
    })),

  updateQuantityGrams: (menuItemId, grams) =>
    set((state) => {
      if (grams <= 0) {
        return { items: state.items.filter((i) => i.menuItemId !== menuItemId) };
      }
      return {
        items: state.items.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantityGrams: grams } : i
        ),
      };
    }),

  updateNotes: (menuItemId, notes) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, notes } : i
      ),
    })),

  clearCart: () => set({ items: [], tableNumber: "" }),

  itemCount: () => get().items.length,

  subtotalCents: () =>
    get().items.reduce(
      (sum, i) => sum + Math.round((i.priceCents * i.quantityGrams) / 1000),
      0
    ),

  taxCents: () => Math.round(get().subtotalCents() * TAX_RATE),

  totalCents: () => get().subtotalCents() + get().taxCents(),
}));
