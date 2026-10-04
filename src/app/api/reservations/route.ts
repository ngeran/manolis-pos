import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createReservationSchema, updateReservationSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import {
  createReservation,
  listReservations,
  ReservationError,
  updateReservation,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const rows = await listReservations({
    date: params.get("date") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = createReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reservation = await createReservation(parsed.data, user.id);
    return NextResponse.json(reservation, { status: 201 });
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[RESERVATIONS] Booking failed:", err);
    return NextResponse.json({ error: "Booking failed — please try again" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = updateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (typeof body?.id !== "string" || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateReservation(db, body.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
