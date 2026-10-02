import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, menuItems } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createOrderSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: orders.id,
      tableNumber: orders.tableNumber,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      userId: orders.userId,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tableNumber, items } = parsed.data;

  // Only fetch the items actually ordered — never trust client-sent prices.
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const dbItems = await db
    .select({ id: menuItems.id, priceCents: menuItems.priceCents })
    .from(menuItems)
    .where(and(inArray(menuItems.id, menuItemIds), eq(menuItems.available, true)));

  const priceMap = Object.fromEntries(dbItems.map((i) => [i.id, i.priceCents]));

  for (const item of items) {
    if (!(item.menuItemId in priceMap)) {
      return NextResponse.json(
        { error: `Menu item ${item.menuItemId} not found or unavailable` },
        { status: 400 }
      );
    }
  }

  const totalCents = items.reduce(
    (sum, i) => sum + Math.round((priceMap[i.menuItemId] * i.quantityGrams) / 1000),
    0
  );

  const userId = session.user.id!;

  // Order + items must be created atomically — a partial order would be
  // invisible in the history but occupy the table.
  const order = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        userId,
        tableNumber: tableNumber ?? null,
        totalCents,
        status: "pending",
      })
      .returning();

    await tx.insert(orderItems).values(
      items.map((item) => ({
        orderId: created.id,
        menuItemId: item.menuItemId,
        quantityGrams: item.quantityGrams,
        priceAtTimeCents: priceMap[item.menuItemId],
        notes: item.notes ?? null,
      }))
    );

    return created;
  });

  return NextResponse.json(order, { status: 201 });
}
