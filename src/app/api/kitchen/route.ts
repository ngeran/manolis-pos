import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orders, stations } from "@/lib/db/schema";
import { and, eq, gte, inArray, ne, or } from "drizzle-orm";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { DONE_UNDO_WINDOW_MS } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

/** How long a just-served order stays visible so the kitchen sees it leave. */
const SERVED_VISIBLE_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const stationSlug = new URL(request.url).searchParams.get("station");
  const allStations = await db.select().from(stations).orderBy(stations.sortOrder);

  let stationId: string | null = null;
  if (stationSlug && stationSlug !== "all") {
    const st = allStations.find((s) => s.slug === stationSlug);
    if (!st) {
      return NextResponse.json({ error: "Unknown station" }, { status: 400 });
    }
    stationId = st.id;
  }

  const doneCutoff = new Date(Date.now() - DONE_UNDO_WINDOW_MS);
  const servedCutoff = new Date(Date.now() - SERVED_VISIBLE_MS);

  // Step 1: which orders currently qualify?
  // - Active orders with work for the station (or a fresh undo strip).
  // - Just-served orders stay visible briefly so the kitchen sees them leave.
  const qualifying = await db
    .selectDistinct({ orderId: orderItems.orderId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        or(
          and(
            inArray(orders.status, ["sent", "preparing", "ready"]),
            ne(orderItems.status, "voided"),
            or(
              inArray(orderItems.status, ["held", "queued"]),
              gte(orderItems.doneAt, doneCutoff)
            )
          ),
          and(
            eq(orders.status, "served"),
            gte(orders.servedAt, servedCutoff),
            ne(orderItems.status, "voided")
          )
        ),
        stationId ? eq(orderItems.stationId, stationId) : undefined
      )
    );
  const orderIds = qualifying.map((q) => q.orderId);
  if (orderIds.length === 0) {
    return NextResponse.json({ serverTime: new Date().toISOString(), stations: allStations, tickets: [] });
  }

  // Step 2: load ALL non-voided items of those orders so tickets keep their
  // full context (done counts across stations) even in station-scoped views.
  const [orderRows, itemRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        dailyNumber: orders.dailyNumber,
        tableNumber: orders.tableNumber,
        guestName: orders.guestName,
        status: orders.status,
        priority: orders.priority,
        sentAt: orders.sentAt,
      })
      .from(orders)
      .where(inArray(orders.id, orderIds)),
    db
      .select({
        orderId: orderItems.orderId,
        id: orderItems.id,
        nameEl: orderItems.nameEl,
        nameEn: orderItems.nameEn,
        quantityGrams: orderItems.quantityGrams,
        pricingType: orderItems.pricingType,
        notes: orderItems.notes,
        status: orderItems.status,
        round: orderItems.round,
        sentAt: orderItems.sentAt,
        firedAt: orderItems.firedAt,
        doneAt: orderItems.doneAt,
        stationId: orderItems.stationId,
        stationSlug: stations.slug,
      })
      .from(orderItems)
      .leftJoin(stations, eq(orderItems.stationId, stations.id))
      .where(and(inArray(orderItems.orderId, orderIds), ne(orderItems.status, "voided")))
      .orderBy(orderItems.round, orderItems.sentAt),
  ]);

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const tickets = orderRows
    .map((order) => {
      const allItems = itemsByOrder.get(order.id) ?? [];
      const visibleItems = stationId
        ? allItems.filter((i) => i.stationId === stationId)
        : allItems;
      if (visibleItems.length === 0) return null;

      // How many items other stations still owe (context for this station's cook).
      const otherOpenCount = stationId
        ? allItems.filter(
            (i) => i.stationId !== stationId && (i.status === "held" || i.status === "queued")
          ).length
        : 0;

      const activeTimes = allItems
        .filter((i) => i.status === "held" || i.status === "queued")
        .map((i) => (i.firedAt ?? i.sentAt).getTime());
      const oldestActive = activeTimes.length > 0 ? Math.min(...activeTimes) : null;

      return {
        orderId: order.id,
        dailyNumber: order.dailyNumber,
        tableNumber: order.tableNumber,
        guestName: order.guestName,
        status: order.status,
        priority: order.priority,
        sentAt: order.sentAt,
        oldestActiveAt: oldestActive ? new Date(oldestActive).toISOString() : null,
        otherOpenCount,
        items: visibleItems,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      const aTime = a.oldestActiveAt ? Date.parse(a.oldestActiveAt) : a.sentAt.getTime();
      const bTime = b.oldestActiveAt ? Date.parse(b.oldestActiveAt) : b.sentAt.getTime();
      return aTime - bTime;
    });

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    stations: allStations,
    tickets,
  });
}
