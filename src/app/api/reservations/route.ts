import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { diningTables, reservations } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { createReservationSchema, updateReservationSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { athensBusinessDate } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const date =
    new URL(request.url).searchParams.get("date") ?? athensBusinessDate();

  const rows = await db
    .select({
      id: reservations.id,
      businessDate: reservations.businessDate,
      time: reservations.time,
      name: reservations.name,
      guests: reservations.guests,
      phone: reservations.phone,
      notes: reservations.notes,
      status: reservations.status,
      orderId: reservations.orderId,
      tableId: reservations.tableId,
      tableName: diningTables.name,
    })
    .from(reservations)
    .leftJoin(diningTables, eq(reservations.tableId, diningTables.id))
    .where(eq(reservations.businessDate, date))
    .orderBy(asc(reservations.time));

  return NextResponse.json({ date, reservations: rows });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = createReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [row] = await db
    .insert(reservations)
    .values({
      businessDate: parsed.data.businessDate ?? athensBusinessDate(),
      time: parsed.data.time,
      name: parsed.data.name,
      guests: parsed.data.guests,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
      tableId: parsed.data.tableId ?? null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = updateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, status, ...updates } = parsed.data;
  const update: Partial<typeof reservations.$inferInsert> = { ...updates };
  if (status) update.status = status;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(reservations)
    .set(update)
    .where(eq(reservations.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
