import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, diningTables, reservations } from "@/lib/db/schema";
import { and, asc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { createReservationSchema, updateReservationSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { athensBusinessDate } from "@/lib/orders";
import { normalizeTime, slotHasCapacity, splitFullName } from "@/lib/booking";

export const dynamic = "force-dynamic";

const MAX_COVERS_PER_SLOT = Number(process.env.MAX_COVERS_PER_SLOT) || 40;
const MAX_DAYS_AHEAD = 60;

// Ported from manolis-booking: slot capacity with advisory locking,
// race-safe customer upsert by phone, extended with POS table assignment.

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");

  let where;
  if (date) {
    where = eq(reservations.reservationDate, date);
  } else if (from && to) {
    where = and(gte(reservations.reservationDate, from), lte(reservations.reservationDate, to));
  }

  const rows = await db
    .select({
      id: reservations.id,
      partySize: reservations.partySize,
      reservationDate: reservations.reservationDate,
      reservationTime: reservations.reservationTime,
      status: reservations.status,
      specialRequests: reservations.specialRequests,
      createdAt: reservations.createdAt,
      customerId: reservations.customerId,
      tableId: reservations.tableId,
      orderId: reservations.orderId,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerPhone: customers.phone,
      tableName: diningTables.name,
    })
    .from(reservations)
    .innerJoin(customers, eq(reservations.customerId, customers.id))
    .leftJoin(diningTables, eq(reservations.tableId, diningTables.id))
    .where(where)
    .orderBy(asc(reservations.reservationDate), asc(reservations.reservationTime));

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
  const data = parsed.data;
  const reservationDate = data.reservationDate ?? athensBusinessDate();
  const reservationTime = normalizeTime(data.reservationTime);

  // Date window: no past bookings, max 60 days ahead (Athens business dates).
  const today = athensBusinessDate();
  if (reservationDate < today) {
    return NextResponse.json({ error: "Cannot book in the past" }, { status: 400 });
  }
  const maxDate = new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000);
  if (reservationDate > athensBusinessDate(maxDate)) {
    return NextResponse.json(
      { error: `Max ${MAX_DAYS_AHEAD} days in advance` },
      { status: 400 }
    );
  }

  if (data.tableId) {
    const [table] = await db
      .select({ id: diningTables.id })
      .from(diningTables)
      .where(eq(diningTables.id, data.tableId));
    if (!table) {
      return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    }
  }

  // Customer: existing id, or upsert-by-phone so returning guests stay one record.
  let customerId = data.customerId ?? null;
  if (!customerId && data.customerPhone) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, data.customerPhone))
      .limit(1);
    if (existing) {
      customerId = existing.id;
    } else {
      const name = splitFullName(data.customerName ?? "Unknown");
      try {
        const [created] = await db
          .insert(customers)
          .values({ firstName: name.firstName, lastName: name.lastName, phone: data.customerPhone })
          .returning();
        customerId = created.id;
      } catch (err) {
        // 23505: a concurrent request created this phone mid-flight.
        if ((err as { code?: string }).code !== "23505") throw err;
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.phone, data.customerPhone))
          .limit(1);
        if (!existing) throw err;
        customerId = existing.id;
      }
    }
  }
  if (!customerId) {
    return NextResponse.json(
      { error: "Customer name + phone or customerId required" },
      { status: 400 }
    );
  }

  try {
    const booked = await db.transaction(async (tx) => {
      // Serialize concurrent bookings for the same slot; the advisory lock is
      // released automatically when the transaction ends.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${reservationDate} || ' ' || ${reservationTime}))`
      );

      // Covers already booked for the slot (excluding cancellations/no-shows).
      const [row] = await tx
        .select({ total: sql<number>`COALESCE(sum(${reservations.partySize}), 0)` })
        .from(reservations)
        .where(
          and(
            eq(reservations.reservationDate, reservationDate),
            eq(reservations.reservationTime, reservationTime),
            ne(reservations.status, "cancelled"),
            ne(reservations.status, "no_show")
          )
        );

      if (!slotHasCapacity(Number(row?.total ?? 0), data.partySize, MAX_COVERS_PER_SLOT)) {
        return { conflict: "slot" as const, reservation: null };
      }

      // The assigned table must be free at that slot.
      if (data.tableId) {
        const [clash] = await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.reservationDate, reservationDate),
              eq(reservations.reservationTime, reservationTime),
              eq(reservations.tableId, data.tableId),
              ne(reservations.status, "cancelled"),
              ne(reservations.status, "no_show")
            )
          );
        if (clash) {
          return { conflict: "table" as const, reservation: null };
        }
      }

      const [reservation] = await tx
        .insert(reservations)
        .values({
          customerId,
          partySize: data.partySize,
          reservationDate,
          reservationTime,
          employeeId: user.id,
          specialRequests: data.specialRequests ?? null,
          tableId: data.tableId ?? null,
        })
        .returning();
      return { conflict: null, reservation };
    });

    if (booked.conflict) {
      return NextResponse.json(
        {
          error:
            booked.conflict === "slot"
              ? "Η ώρα είναι πλήρης — δοκιμάστε άλλη"
              : "Το τραπέζι είναι ήδη κρατημένο για αυτή την ώρα",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(booked.reservation, { status: 201 });
  } catch (err) {
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

  // The schema ignores unknown keys (including id), so read it from the body.
  const id = typeof body?.id === "string" ? body.id : "";
  const update: Partial<typeof reservations.$inferInsert> = { ...parsed.data };
  if (!id || Object.keys(update).length === 0) {
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
