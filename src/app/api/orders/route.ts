import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  customers,
  diningTables,
  menuItems,
  orderItems,
  orderTables,
  orders,
  reservations,
  stations,
  users,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, lte, max, or, sql } from "drizzle-orm";
import { createOrderSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import {
  athensBusinessDate,
  isTerminalStatus,
  loadOrderDetail,
  nextDailyNumber,
  OrderError,
  orderErrorResponse,
  recomputeOrderStatus,
  recomputeTotalCents,
} from "@/lib/orders";
import { markReservationSeated } from "@/lib/reservations";

export const dynamic = "force-dynamic";

const SERVED_BOARD_WINDOW_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "all";
  // Optional lookback window for history (Athens business dates, inclusive).
  const from = params.get("from");
  const to = params.get("to");

  let where;
  if (scope === "active") {
    const cutoff = new Date(Date.now() - SERVED_BOARD_WINDOW_MS);
    where = or(
      inArray(orders.status, ["sent", "preparing", "ready"]),
      and(eq(orders.status, "served"), gte(orders.servedAt, cutoff))
    );
  } else if (scope === "closed") {
    where = and(
      inArray(orders.status, ["paid", "cancelled"]),
      from ? gte(orders.businessDate, from) : undefined,
      to ? lte(orders.businessDate, to) : undefined
    );
  }

  const rows = await db
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
      servedAt: orders.servedAt,
      paidAt: orders.paidAt,
      cancelledAt: orders.cancelledAt,
      cancelReason: orders.cancelReason,
      cancelNote: orders.cancelNote,
      refundedAt: orders.refundedAt,
      refundReason: orders.refundReason,
      refundNote: orders.refundNote,
      createdAt: orders.createdAt,
      userId: orders.userId,
      openedByName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(where)
    .orderBy(desc(orders.priority), desc(orders.sentAt))
    .limit(scope === "closed" ? 500 : 1000);

  // Per-order item aggregates + per-station progress + items for the cards.
  const ids = rows.map((r) => r.id);
  const itemRows = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          nameEl: orderItems.nameEl,
          quantityGrams: orderItems.quantityGrams,
          pricingType: orderItems.pricingType,
          priceAtTimeCents: orderItems.priceAtTimeCents,
          status: orderItems.status,
          round: orderItems.round,
          stationSlug: stations.slug,
          stationNameEl: stations.nameEl,
        })
        .from(orderItems)
        .leftJoin(stations, eq(orderItems.stationId, stations.id))
        .where(inArray(orderItems.orderId, ids))
        .orderBy(orderItems.round, orderItems.sentAt)
    : [];

  const agg = new Map<string, { itemCount: number; doneCount: number; heldCount: number; voidedCount: number; stations: Map<string, { slug: string | null; nameEl: string | null; openCount: number; doneCount: number }> }>();
  for (const item of itemRows) {
    let a = agg.get(item.orderId);
    if (!a) {
      a = { itemCount: 0, doneCount: 0, heldCount: 0, voidedCount: 0, stations: new Map() };
      agg.set(item.orderId, a);
    }
    a.itemCount++;
    if (item.status === "done") a.doneCount++;
    else if (item.status === "held") a.heldCount++;
    else if (item.status === "voided") a.voidedCount++;
    const key = item.stationSlug ?? "none";
    const st = a.stations.get(key) ?? { slug: item.stationSlug, nameEl: item.stationNameEl, openCount: 0, doneCount: 0 };
    if (item.status === "done") st.doneCount++;
    else if (item.status !== "voided") st.openCount++;
    a.stations.set(key, st);
  }

  // Per-order occupied table names (for the table grid's occupancy).
  const tableRows = ids.length
    ? await db
        .select({
          orderId: orderTables.orderId,
          name: diningTables.name,
          sortOrder: diningTables.sortOrder,
        })
        .from(orderTables)
        .innerJoin(diningTables, eq(orderTables.tableId, diningTables.id))
        .where(inArray(orderTables.orderId, ids))
    : [];
  const tablesByOrder = new Map<string, { name: string; sortOrder: number }[]>();
  for (const t of tableRows) {
    const list = tablesByOrder.get(t.orderId) ?? [];
    list.push({ name: t.name, sortOrder: t.sortOrder });
    tablesByOrder.set(t.orderId, list);
  }

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }

  const result = rows.map((r) => {
    const a = agg.get(r.id);
    return {
      ...r,
      tableNames: (tablesByOrder.get(r.id) ?? [])
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map((t) => t.name),
      itemCount: a?.itemCount ?? 0,
      doneCount: a?.doneCount ?? 0,
      heldCount: a?.heldCount ?? 0,
      voidedCount: a?.voidedCount ?? 0,
      stations: a ? [...a.stations.values()].filter((s) => s.slug) : [],
      items: itemsByOrder.get(r.id) ?? [],
    };
  });

  return NextResponse.json({ serverTime: new Date().toISOString(), orders: result });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tableNumber, guests, guestName, reservationId, tableIds, orderId, items } = parsed.data;

  // Seating a reservation: pre-fill table/party/name from it and mark it seated
  // once the order is created.
  let reservation: typeof reservations.$inferSelect | null = null;
  let reservationCustomer: typeof customers.$inferSelect | null = null;
  if (reservationId) {
    const [r] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    if (!r) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 400 });
    }
    if (r.status !== "confirmed") {
      return NextResponse.json({ error: "Reservation is not active" }, { status: 409 });
    }
    const [c] = await db.select().from(customers).where(eq(customers.id, r.customerId));
    reservation = r;
    reservationCustomer = c ?? null;
  }

  const effectiveTableIds =
    tableIds && tableIds.length > 0
      ? tableIds
      : reservation?.tableId
        ? [reservation.tableId]
        : undefined;
  const effectiveGuests = guests ?? reservation?.partySize ?? undefined;
  const effectiveGuestName =
    guestName ??
    (reservationCustomer
      ? `${reservationCustomer.firstName} ${reservationCustomer.lastName}`.trim()
      : undefined);

  // Resolve the occupied dining tables; the display label is derived from
  // them ("12+4") so combined tables stay consistent everywhere.
  let tableLabel = tableNumber || null;
  let resolvedTableIds: string[] = [];
  if (effectiveTableIds && effectiveTableIds.length > 0) {
    const uniqueIds = [...new Set(effectiveTableIds)];
    const rows = await db
      .select({ id: diningTables.id, name: diningTables.name, sortOrder: diningTables.sortOrder })
      .from(diningTables)
      .where(inArray(diningTables.id, uniqueIds));
    if (rows.length !== uniqueIds.length) {
      return NextResponse.json({ error: "Unknown table in tableIds" }, { status: 400 });
    }
    resolvedTableIds = uniqueIds;
    tableLabel = rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.name)
      .join("+");
  }

  // Only fetch the items actually ordered — never trust client-sent data.
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const dbItems = await db
    .select({
      id: menuItems.id,
      priceCents: menuItems.priceCents,
      nameEl: menuItems.nameEl,
      nameEn: menuItems.nameEn,
      pricingType: menuItems.pricingType,
      stationId: menuItems.stationId,
      available: menuItems.available,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, menuItemIds));
  const menuMap = new Map(dbItems.map((m) => [m.id, m]));

  for (const item of items) {
    const m = menuMap.get(item.menuItemId);
    if (!m || !m.available) {
      return NextResponse.json(
        { error: `Menu item ${item.menuItemId} not found or unavailable` },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  try {
    if (orderId) {
      // ── Append a new round to a live order ──
      await db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
        if (!order) throw new OrderError(404, "Order not found");
        if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");

        const [{ maxRound }] = await tx
          .select({ maxRound: max(orderItems.round) })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        const round = (maxRound ?? 0) + 1;

        await tx.insert(orderItems).values(
          items.map((item) => {
            const m = menuMap.get(item.menuItemId)!;
            return {
              orderId,
              menuItemId: item.menuItemId,
              quantityGrams: item.quantityGrams,
              priceAtTimeCents: m.priceCents,
              notes: item.notes ?? null,
              nameEl: m.nameEl,
              nameEn: m.nameEn,
              pricingType: m.pricingType,
              stationId: m.stationId,
              status: item.hold ? ("held" as const) : ("queued" as const),
              round,
              sentAt: now,
              firedAt: item.hold ? null : now,
            };
          })
        );

        const orderUpdates: Partial<typeof orders.$inferInsert> = {};
        if (tableIds && tableIds.length > 0) orderUpdates.tableNumber = tableLabel;
        else if (tableNumber) orderUpdates.tableNumber = tableNumber;
        if (guests !== undefined) orderUpdates.guests = guests;
        if (effectiveGuestName !== undefined) orderUpdates.guestName = effectiveGuestName;
        if (Object.keys(orderUpdates).length > 0) {
          await tx.update(orders).set(orderUpdates).where(eq(orders.id, orderId));
        }

        // Replace the occupied-tables link for the order.
        await tx.delete(orderTables).where(eq(orderTables.orderId, orderId));
        if (resolvedTableIds.length > 0) {
          await tx
            .insert(orderTables)
            .values(resolvedTableIds.map((tid) => ({ orderId, tableId: tid })));
        }

        await recomputeOrderStatus(tx, orderId);
        await recomputeTotalCents(tx, orderId);
      });

      const detail = await loadOrderDetail(orderId);
      return NextResponse.json(detail, { status: 200 });
    }

    // ── Create a new order ──
    const created = await db.transaction(async (tx) => {
      const businessDate = athensBusinessDate(now);
      const dailyNumber = await nextDailyNumber(tx, businessDate);
      const totalCents = items.reduce((sum, item) => {
        const m = menuMap.get(item.menuItemId)!;
        return sum + Math.round((m.priceCents * item.quantityGrams) / 1000);
      }, 0);

      const [order] = await tx
        .insert(orders)
        .values({
          userId: user.id,
          tableNumber: tableLabel,
          guests: effectiveGuests ?? null,
          guestName: effectiveGuestName ?? null,
          totalCents,
          businessDate,
          dailyNumber,
          status: "sent",
          sentAt: now,
        })
        .returning();

      if (resolvedTableIds.length > 0) {
        await tx
          .insert(orderTables)
          .values(resolvedTableIds.map((tid) => ({ orderId: order.id, tableId: tid })));
      }

      if (reservation) {
        // Race-safe: fails the whole order transaction if someone seated it first.
        await markReservationSeated(tx, reservation.id, order.id);
      }

      // CRM: the visit counts the moment the party is seated.
      if (reservationCustomer) {
        await tx
          .update(customers)
          .set({
            totalVisits: sql`${customers.totalVisits} + 1`,
            lastVisit: new Date(),
          })
          .where(eq(customers.id, reservationCustomer.id));
      }

      await tx.insert(orderItems).values(
        items.map((item) => {
          const m = menuMap.get(item.menuItemId)!;
          return {
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantityGrams: item.quantityGrams,
            priceAtTimeCents: m.priceCents,
            notes: item.notes ?? null,
            nameEl: m.nameEl,
            nameEn: m.nameEn,
            pricingType: m.pricingType,
            stationId: m.stationId,
            status: item.hold ? ("held" as const) : ("queued" as const),
            round: 1,
            sentAt: now,
            firedAt: item.hold ? null : now,
          };
        })
      );

      return order;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const handled = orderErrorResponse(err);
    if (handled) return handled;
    throw err;
  }
}
