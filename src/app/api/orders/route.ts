import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { menuItems, orderItems, orders, stations, users } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, max, or } from "drizzle-orm";
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

export const dynamic = "force-dynamic";

const SERVED_BOARD_WINDOW_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const scope = new URL(request.url).searchParams.get("scope") ?? "all";

  let where;
  if (scope === "active") {
    const cutoff = new Date(Date.now() - SERVED_BOARD_WINDOW_MS);
    where = or(
      inArray(orders.status, ["sent", "preparing", "ready"]),
      and(eq(orders.status, "served"), gte(orders.servedAt, cutoff))
    );
  } else if (scope === "closed") {
    where = inArray(orders.status, ["paid", "cancelled"]);
  }

  const rows = await db
    .select({
      id: orders.id,
      tableNumber: orders.tableNumber,
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
      createdAt: orders.createdAt,
      userId: orders.userId,
      openedByName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(where)
    .orderBy(desc(orders.priority), desc(orders.sentAt));

  // Per-order item aggregates + per-station progress for the board.
  const ids = rows.map((r) => r.id);
  const itemRows = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          status: orderItems.status,
          stationSlug: stations.slug,
          stationNameEl: stations.nameEl,
        })
        .from(orderItems)
        .leftJoin(stations, eq(orderItems.stationId, stations.id))
        .where(inArray(orderItems.orderId, ids))
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

  const result = rows.map((r) => {
    const a = agg.get(r.id);
    return {
      ...r,
      itemCount: a?.itemCount ?? 0,
      doneCount: a?.doneCount ?? 0,
      heldCount: a?.heldCount ?? 0,
      voidedCount: a?.voidedCount ?? 0,
      stations: a ? [...a.stations.values()].filter((s) => s.slug) : [],
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

  const { tableNumber, orderId, items } = parsed.data;

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

        if (tableNumber) {
          await tx.update(orders).set({ tableNumber }).where(eq(orders.id, orderId));
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
          tableNumber: tableNumber || null,
          totalCents,
          businessDate,
          dailyNumber,
          status: "sent",
          sentAt: now,
        })
        .returning();

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
