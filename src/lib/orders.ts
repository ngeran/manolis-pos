import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  diningTables,
  orderCounters,
  orderItems,
  orderTables,
  orders,
  stations,
  users,
  type OrderStatus,
} from "@/lib/db/schema";

/** Transaction client type — what db.transaction hands to its callback. */
export type OrderTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Expected business-rule failure inside a transaction — maps to an HTTP status. */
export class OrderError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function orderErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof OrderError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * Athens calendar day (the restaurant's business day), as YYYY-MM-DD.
 * en-CA locale yields ISO-formatted dates.
 */
export function athensBusinessDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

/** Atomic daily order number (#1, #2, …) per business date. */
export async function nextDailyNumber(tx: OrderTx, businessDate: string): Promise<number> {
  const [row] = await tx
    .insert(orderCounters)
    .values({ businessDate, lastNumber: 1 })
    .onConflictDoUpdate({
      target: orderCounters.businessDate,
      set: { lastNumber: sql`${orderCounters.lastNumber} + 1` },
    })
    .returning();
  return row.lastNumber;
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === "paid" || status === "cancelled";
}

/**
 * Recompute order status from its item states. Held items block ready.
 * Orders with zero non-voided items keep their current status — the board
 * surfaces them for admin cancel/close instead.
 */
export async function recomputeOrderStatus(
  tx: OrderTx,
  orderId: string
): Promise<OrderStatus | undefined> {
  const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!order) return undefined;
  if (isTerminalStatus(order.status)) return order.status;

  const items = await tx
    .select({ status: orderItems.status })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const active = items.filter((i) => i.status !== "voided");
  if (active.length === 0) return order.status;

  const allDone = active.every((i) => i.status === "done");
  const anyFired = active.some((i) => i.status !== "held");
  const next: OrderStatus = allDone ? "ready" : anyFired ? "preparing" : "sent";
  if (next !== order.status) {
    await tx.update(orders).set({ status: next }).where(eq(orders.id, orderId));
  }
  return next;
}

/** Total = sum of non-voided line totals. Never trust client-computed totals. */
export async function recomputeTotalCents(tx: OrderTx, orderId: string): Promise<number> {
  const items = await tx
    .select({
      priceAtTimeCents: orderItems.priceAtTimeCents,
      quantityGrams: orderItems.quantityGrams,
      status: orderItems.status,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const total = items
    .filter((i) => i.status !== "voided")
    .reduce((sum, i) => sum + Math.round((i.priceAtTimeCents * i.quantityGrams) / 1000), 0);
  await tx.update(orders).set({ totalCents: total }).where(eq(orders.id, orderId));
  return total;
}

const voidingUsers = alias(users, "voiding_users");
const refundingUsers = alias(users, "refunding_users");

/** Full order payload for the detail screen — includes voided items with their audit trail. */
export async function loadOrderDetail(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      tableNumber: orders.tableNumber,
      guests: orders.guests,
      status: orders.status,
      priority: orders.priority,
      totalCents: orders.totalCents,
      businessDate: orders.businessDate,
      dailyNumber: orders.dailyNumber,
      sentAt: orders.sentAt,
      servedAt: orders.servedAt,
      paidAt: orders.paidAt,
      cancelledAt: orders.cancelledAt,
      cancelReason: orders.cancelReason,
      cancelNote: orders.cancelNote,
      refundedAt: orders.refundedAt,
      refundReason: orders.refundReason,
      refundNote: orders.refundNote,
      refundedByName: refundingUsers.name,
      openedByName: users.name,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .leftJoin(refundingUsers, eq(orders.refundedBy, refundingUsers.id))
    .where(eq(orders.id, orderId));
  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      menuItemId: orderItems.menuItemId,
      nameEl: orderItems.nameEl,
      nameEn: orderItems.nameEn,
      quantityGrams: orderItems.quantityGrams,
      pricingType: orderItems.pricingType,
      priceAtTimeCents: orderItems.priceAtTimeCents,
      notes: orderItems.notes,
      status: orderItems.status,
      round: orderItems.round,
      sentAt: orderItems.sentAt,
      firedAt: orderItems.firedAt,
      doneAt: orderItems.doneAt,
      stationSlug: stations.slug,
      stationNameEl: stations.nameEl,
      voidedReason: orderItems.voidedReason,
      voidedNote: orderItems.voidedNote,
      voidedAt: orderItems.voidedAt,
      voidedByName: voidingUsers.name,
    })
    .from(orderItems)
    .leftJoin(stations, eq(orderItems.stationId, stations.id))
    .leftJoin(voidingUsers, eq(orderItems.voidedBy, voidingUsers.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.round, orderItems.sentAt);

  const tableRows = await db
    .select({ name: diningTables.name, sortOrder: diningTables.sortOrder })
    .from(orderTables)
    .innerJoin(diningTables, eq(orderTables.tableId, diningTables.id))
    .where(eq(orderTables.orderId, orderId))
    .orderBy(diningTables.sortOrder);

  return { ...order, tableNames: tableRows.map((t) => t.name), items };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
