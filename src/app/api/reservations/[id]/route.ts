import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateReservationSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { normalizeTime } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Whitelist editable fields — never pass the request body straight to the DB.
  const updates: Partial<typeof reservations.$inferInsert> = {};
  const data = parsed.data;
  if (data.partySize !== undefined) updates.partySize = data.partySize;
  if (data.reservationTime !== undefined) {
    updates.reservationTime = normalizeTime(data.reservationTime);
  }
  if (data.status !== undefined) updates.status = data.status;
  if (data.specialRequests !== undefined) {
    updates.specialRequests = data.specialRequests;
  }
  if (data.tableId !== undefined) updates.tableId = data.tableId;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(reservations)
    .set(updates)
    .where(eq(reservations.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  // Soft cancel — reservation history is never deleted.
  const [updated] = await db
    .update(reservations)
    .set({ status: "cancelled" })
    .where(eq(reservations.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
