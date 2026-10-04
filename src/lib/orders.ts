import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
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
import type { ItemAction, OrderAction } from "@/lib/validations";

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
 *
 * Stamps preparingAt / readyAt the first time the order reaches those
 * states, so kitchen speed is measurable end to end.
 */
export async function recomputeOrderStatus(
  tx: OrderTx,
  orderId: string
): Promise<OrderStatus | undefined> {
  const [order] = await tx
    .select({ status: orders.status, preparingAt: orders.preparingAt, readyAt: orders.readyAt })
    .from(orders)
    .where(eq(orders.id, orderId));
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
    const now = new Date();
    const patch: Partial<typeof orders.$inferInsert> = { status: next };
    if (next === "preparing" && !order.preparingAt) patch.preparingAt = now;
    if (next === "ready") {
      patch.readyAt = order.readyAt ?? now;
      if (!order.preparingAt) patch.preparingAt = now;
    }
    await tx.update(orders).set(patch).where(eq(orders.id, orderId));
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
const bumpingUsers = alias(users, "bumping_users");

/** Who is performing an action — role decides which actions are allowed. */
export interface OrderActor {
  id: string;
  isAdmin: boolean;
}

/**
 * Order-engine: apply a manual action to an order inside a transaction.
 * All state guards, role rules and timestamps live here — routes only
 * authenticate, parse and respond.
 */
export async function applyOrderAction(
  tx: OrderTx,
  opts: {
    orderId: string;
    actor: OrderActor;
    action: OrderAction;
  }
) {
  const { orderId, actor, action } = opts;
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new OrderError(404, "Order not found");

  switch (action.action) {
    case "fire": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      await tx
        .update(orderItems)
        .set({ status: "queued", firedAt: new Date() })
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.status, "held")));
      break;
    }
    case "rush": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      await tx
        .update(orders)
        .set({ priority: true, priorityAt: new Date() })
        .where(eq(orders.id, orderId));
      break;
    }
    case "unrush": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      await tx
        .update(orders)
        .set({ priority: false, priorityAt: null })
        .where(eq(orders.id, orderId));
      break;
    }
    case "serve": {
      if (order.status !== "ready") {
        throw new OrderError(409, `Cannot serve an order that is ${order.status}`);
      }
      await tx
        .update(orders)
        .set({ status: "served", servedAt: new Date() })
        .where(eq(orders.id, orderId));
      break;
    }
    case "paid": {
      if (order.status !== "served") {
        throw new OrderError(409, `Cannot close an order that is ${order.status}`);
      }
      await tx
        .update(orders)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(orders.id, orderId));
      break;
    }
    case "cancel": {
      if (!actor.isAdmin) throw new OrderError(403, "Only admins can cancel an order");
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      if (action.reason === "other" && !action.note?.trim()) {
        throw new OrderError(400, "A note is required when the reason is 'other'");
      }
      await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: actor.id,
          cancelReason: action.reason,
          cancelNote: action.note ?? null,
        })
        .where(eq(orders.id, orderId));
      break;
    }
    case "refund": {
      if (!actor.isAdmin) throw new OrderError(403, "Only admins can mark a refund");
      if (order.status !== "paid") {
        throw new OrderError(409, "Only paid orders can be marked as refunded");
      }
      if (order.refundedAt) {
        throw new OrderError(409, "Order is already marked as refunded");
      }
      if (action.reason === "other" && !action.note?.trim()) {
        throw new OrderError(400, "A note is required when the reason is 'other'");
      }
      await tx
        .update(orders)
        .set({
          refundedAt: new Date(),
          refundedBy: actor.id,
          refundReason: action.reason,
          refundNote: action.note ?? null,
        })
        .where(eq(orders.id, orderId));
      break;
    }
  }

  if (action.action === "fire") {
    await recomputeOrderStatus(tx, orderId);
  }
}

/**
 * Order-engine: apply an action to a single order item (bump/unbump/fire/void)
 * inside a transaction. Bumps record who completed the item.
 */
export async function applyItemAction(
  tx: OrderTx,
  opts: {
    orderId: string;
    itemId: string;
    actor: OrderActor;
    action: ItemAction;
  }
) {
  const { orderId, itemId, actor, action } = opts;

  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new OrderError(404, "Order not found");

  const [item] = await tx
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));
  if (!item) throw new OrderError(404, "Item not found");

  switch (action.action) {
    case "bump": {
      if (item.status !== "queued") {
        throw new OrderError(409, `Only queued items can be bumped (item is ${item.status})`);
      }
      await tx
        .update(orderItems)
        .set({ status: "done", doneAt: new Date(), bumpedBy: actor.id })
        .where(eq(orderItems.id, itemId));
      break;
    }
    case "unbump": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      if (item.status !== "done") {
        throw new OrderError(409, `Only done items can be unbumped (item is ${item.status})`);
      }
      await tx
        .update(orderItems)
        .set({ status: "queued", doneAt: null, bumpedBy: null })
        .where(eq(orderItems.id, itemId));
      break;
    }
    case "fire": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      if (item.status !== "held") {
        throw new OrderError(409, `Only held items can be fired (item is ${item.status})`);
      }
      await tx
        .update(orderItems)
        .set({ status: "queued", firedAt: new Date() })
        .where(eq(orderItems.id, itemId));
      break;
    }
    case "void": {
      if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
      if (item.status === "voided") throw new OrderError(409, "Item already voided");
      if (action.reason === "other" && !action.note?.trim()) {
        throw new OrderError(400, "A note is required when the reason is 'other'");
      }
      await tx
        .update(orderItems)
        .set({
          status: "voided",
          voidedReason: action.reason,
          voidedNote: action.note ?? null,
          voidedBy: actor.id,
          voidedAt: new Date(),
        })
        .where(eq(orderItems.id, itemId));
      break;
    }
  }

  await recomputeOrderStatus(tx, orderId);
  await recomputeTotalCents(tx, orderId);
}

/** Full order payload for the detail screen — includes voided items with their audit trail. */
export async function loadOrderDetail(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      tableNumber: orders.tableNumber,
      guests: orders.guests,
      guestName: orders.guestName,
      status: orders.status,
      priority: orders.priority,
      totalCents: orders.totalCents,
      businessDate: orders.businessDate,
      dailyNumber: orders.dailyNumber,
      sentAt: orders.sentAt,
      preparingAt: orders.preparingAt,
      readyAt: orders.readyAt,
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
      bumpedByName: bumpingUsers.name,
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
    .leftJoin(bumpingUsers, eq(orderItems.bumpedBy, bumpingUsers.id))
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
