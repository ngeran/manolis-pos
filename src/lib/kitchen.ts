import type { OrderStatus, VoidReason } from "@/lib/db/schema";

/** Age thresholds for kitchen tickets. */
export const AGE_AMBER_MS = 8 * 60 * 1000;
export const AGE_RED_MS = 15 * 60 * 1000;
/** How long a bumped item stays visible for undo (mirrors the server filter). */
export const DONE_UNDO_WINDOW_MS = 10 * 60 * 1000;

export type AgeClass = "ok" | "amber" | "red";

export function ageClass(oldestActiveAtIso: string | null, nowMs: number): AgeClass {
  if (!oldestActiveAtIso) return "ok";
  const age = nowMs - Date.parse(oldestActiveAtIso);
  if (age >= AGE_RED_MS) return "red";
  if (age >= AGE_AMBER_MS) return "amber";
  return "ok";
}

export const ageChipClasses: Record<AgeClass, string> = {
  ok: "bg-primary-container text-on-primary-container",
  amber: "bg-warning-container text-on-warning-container",
  red: "bg-error-container text-error animate-pulse",
};

/** Compact Greek minutes label, e.g. 7′. */
export function formatAge(fromIso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / 60000));
  return `${minutes}′`;
}

export function roundLabel(round: number): string {
  return `R${round}`;
}

/** "5 άτομα" / "1 άτομο" — party-size label, empty when unset. */
export function guestsLabel(guests: number | null | undefined): string {
  if (!guests || guests < 1) return "";
  return guests === 1 ? "1 άτομο" : `${guests} άτομα`;
}

/** Display label for a table selection: "12" or "12+4" when combined. */
export function tableSelectionLabel(tables: { name: string }[]): string {
  return tables.map((t) => t.name).join("+");
}

export const orderStatusMeta: Record<OrderStatus, { el: string; en: string }> = {
  sent: { el: "Στάλθηκε", en: "Sent" },
  preparing: { el: "Σε εξέλιξη", en: "Preparing" },
  ready: { el: "Έτοιμο", en: "Ready" },
  served: { el: "Σερβιρίστηκε", en: "Served" },
  paid: { el: "Πληρώθηκε", en: "Paid" },
  cancelled: { el: "Ακυρώθηκε", en: "Cancelled" },
};

export const voidReasonMeta: Record<VoidReason, string> = {
  wrong_item: "Λάθος προϊόν",
  unavailable_86: "Δεν υπάρχει (86)",
  customer_changed_mind: "Άλλαξε γνώμη",
  kitchen_error: "Λάθος κουζίνας",
  other: "Άλλο",
};

// ── /api/orders payload types ──

export interface BoardOrderStation {
  slug: string | null;
  nameEl: string | null;
  openCount: number;
  doneCount: number;
}

export interface BoardOrderItem {
  orderId: string;
  nameEl: string;
  quantityGrams: number;
  pricingType: string;
  priceAtTimeCents: number;
  status: "held" | "queued" | "done" | "voided";
  round: number;
  stationSlug: string | null;
  stationNameEl: string | null;
}

export interface BoardOrder {
  id: string;
  tableNumber: string | null;
  /** Names of the dining tables this order occupies (combined tables → several). */
  tableNames: string[];
  guests: number | null;
  status: OrderStatus;
  priority: boolean;
  totalCents: number;
  businessDate: string;
  dailyNumber: number;
  sentAt: string;
  servedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: VoidReason | null;
  cancelNote: string | null;
  refundedAt: string | null;
  refundReason: VoidReason | null;
  refundNote: string | null;
  createdAt: string;
  userId: string;
  openedByName: string | null;
  itemCount: number;
  doneCount: number;
  heldCount: number;
  voidedCount: number;
  stations: BoardOrderStation[];
  items: BoardOrderItem[];
}

export interface OrdersPayload {
  serverTime: string;
  orders: BoardOrder[];
}

// ── /api/tables payload ──

export interface DiningTable {
  id: string;
  name: string;
  nickname: string | null;
  seats: number | null;
  sortOrder: number;
}

// ── /api/orders/[id] payload types ──

export interface OrderDetailItem {
  id: string;
  menuItemId: string;
  nameEl: string;
  nameEn: string;
  quantityGrams: number;
  pricingType: string;
  priceAtTimeCents: number;
  notes: string | null;
  status: "held" | "queued" | "done" | "voided";
  round: number;
  sentAt: string;
  firedAt: string | null;
  doneAt: string | null;
  stationSlug: string | null;
  stationNameEl: string | null;
  voidedReason: VoidReason | null;
  voidedNote: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
}

export interface OrderDetailPayload {
  id: string;
  tableNumber: string | null;
  tableNames: string[];
  guests: number | null;
  status: OrderStatus;
  priority: boolean;
  totalCents: number;
  businessDate: string;
  dailyNumber: number;
  sentAt: string;
  servedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: VoidReason | null;
  cancelNote: string | null;
  refundedAt: string | null;
  refundReason: VoidReason | null;
  refundNote: string | null;
  refundedByName: string | null;
  openedByName: string | null;
  createdAt: string;
  items: OrderDetailItem[];
}

// ── /api/kitchen payload types ──

export interface KitchenItem {
  orderId: string;
  id: string;
  nameEl: string;
  nameEn: string;
  quantityGrams: number;
  pricingType: string;
  notes: string | null;
  status: "held" | "queued" | "done";
  round: number;
  sentAt: string;
  firedAt: string | null;
  doneAt: string | null;
  stationId: string;
  stationSlug: string | null;
}

export interface KitchenTicket {
  orderId: string;
  dailyNumber: number;
  tableNumber: string | null;
  status: OrderStatus;
  priority: boolean;
  sentAt: string;
  oldestActiveAt: string | null;
  otherOpenCount: number;
  items: KitchenItem[];
}

export interface KitchenStation {
  id: string;
  slug: string;
  nameEl: string;
  nameEn: string;
  sortOrder: number;
}

export interface KitchenPayload {
  serverTime: string;
  stations: KitchenStation[];
  tickets: KitchenTicket[];
}
