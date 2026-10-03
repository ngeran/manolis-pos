import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
  pricingType: "unit" | "weight";
  quantityGrams: number;
  notes?: string;
  /** Held items don't reach the stations until someone fires them. */
  hold?: boolean;
}

/** A dining table selected as the order's destination. */
export interface SelectedTable {
  id: string;
  name: string;
}

interface OrderState {
  /** Selected dining tables — one normally, several when combined. [] = takeaway. */
  tables: SelectedTable[];
  /** Party size (άτομα), optional. */
  guests: number | null;
  /** Guest / reservation name, optional. */
  guestName: string | null;
  /** Reservation being seated (links the sent order back to it). */
  reservationId: string | null;
  items: CartItem[];
  /** When set, submitting appends a new round to that live order. */
  editOrderId: string | null;
  editOrderLabel: string | null;
  setTableSelection: (tables: SelectedTable[]) => void;
  setGuests: (guests: number | null) => void;
  setGuestName: (name: string | null) => void;
  setReservationId: (id: string | null) => void;
  addItem: (item: Omit<CartItem, "quantityGrams"> & { quantityGrams: number }) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantityGrams: (menuItemId: string, grams: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
  updateHold: (menuItemId: string, hold: boolean) => void;
  clearCart: () => void;
  startEditOrder: (orderId: string, label: string) => void;
  stopEditOrder: () => void;
  itemCount: () => number;
  subtotalCents: () => number;
  taxCents: () => number;
  totalCents: () => number;
}

const TAX_RATE = 0.13;

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      tables: [],
      guests: null,
      guestName: null,
      reservationId: null,
      items: [],
      editOrderId: null,
      editOrderLabel: null,

      setTableSelection: (tables) => set({ tables }),

      setGuests: (guests) => set({ guests }),

      setGuestName: (guestName) => set({ guestName }),

      setReservationId: (reservationId) => set({ reservationId }),

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

      updateHold: (menuItemId, hold) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, hold } : i
          ),
        })),

      clearCart: () =>
        set({
          items: [],
          tables: [],
          guests: null,
          guestName: null,
          reservationId: null,
          editOrderId: null,
          editOrderLabel: null,
        }),

      startEditOrder: (orderId, label) =>
        set({ editOrderId: orderId, editOrderLabel: label }),

      stopEditOrder: () => set({ editOrderId: null, editOrderLabel: null }),

      itemCount: () => get().items.length,

      subtotalCents: () =>
        get().items.reduce(
          (sum, i) => sum + Math.round((i.priceCents * i.quantityGrams) / 1000),
          0
        ),

      taxCents: () => Math.round(get().subtotalCents() * TAX_RATE),

      totalCents: () => get().subtotalCents() + get().taxCents(),
    }),
    {
      name: "manolis-cart",
      version: 5,
      migrate: (persisted) => {
        const state = persisted as Partial<OrderState> | undefined;
        return {
          ...state,
          items: (state?.items ?? []).map((i) => ({ ...i, hold: i.hold ?? false })),
          tables: Array.isArray(state?.tables) ? state.tables : [],
          guests: state?.guests ?? null,
          guestName: state?.guestName ?? null,
          reservationId: state?.reservationId ?? null,
          editOrderId: null,
          editOrderLabel: null,
        } as OrderState;
      },
      // Rehydrated manually in the app layout effect so the SSR markup
      // (which always renders an empty cart) matches the first client render.
      skipHydration: true,
    }
  )
);
