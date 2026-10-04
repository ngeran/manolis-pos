import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateReservationSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { ReservationError, updateReservation } from "@/lib/reservations";

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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateReservation(db, id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  // Soft cancel — reservation history is never deleted.
  try {
    const updated = await updateReservation(db, id, { status: "cancelled" });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
