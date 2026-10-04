import { and, asc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, diningTables, reservations } from "@/lib/db/schema";
import { athensBusinessDate, type OrderTx } from "@/lib/orders";
import { normalizeTime, slotHasCapacity, splitFullName } from "@/lib/booking";

/**
 * Reservation-engine: all reservation business rules live here — slot
 * capacity, table clashes, customer upsert, status transitions, date
 * windows. Routes authenticate, parse and respond; this module decides.
 */

const MAX_COVERS_PER_SLOT = Number(process.env.MAX_COVERS_PER_SLOT) || 40;
const MAX_DAYS_AHEAD = 60;

export class ReservationError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Works with both a bare db handle and an open transaction. */
export type ReservationClient = typeof db | OrderTx;

export interface UpsertCustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

/** Find a customer by phone (unique), creating them when unknown.
 *  A provided email fills an empty record — never overwrites one. */
export async function upsertCustomerByPhone(
  input: UpsertCustomerInput
): Promise<string> {
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, input.phone))
    .limit(1);

  if (existing) {
    if (input.email && !existing.email) {
      await db
        .update(customers)
        .set({ email: input.email })
        .where(eq(customers.id, existing.id));
    }
    return existing.id;
  }

  const name = splitFullName(input.name ?? "Unknown");
  try {
    const [created] = await db
      .insert(customers)
      .values({
        firstName: name.firstName,
        lastName: name.lastName,
        phone: input.phone,
        email: input.email ?? null,
      })
      .returning();
    return created.id;
  } catch (err) {
    // 23505: a concurrent request created this phone mid-flight.
    if ((err as { code?: string }).code !== "23505") throw err;
    const [again] = await db
      .select({ id: customers.id, email: customers.email })
      .from(customers)
      .where(eq(customers.phone, input.phone))
      .limit(1);
    if (!again) throw err;
    if (input.email && !again.email) {
      await db
        .update(customers)
        .set({ email: input.email })
        .where(eq(customers.id, again.id));
    }
    return again.id;
  }
}

export interface CreateReservationInput {
  reservationDate?: string;
  reservationTime: string;
  partySize: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  tableId?: string;
  specialRequests?: string;
}

/**
 * Create a reservation: date windows, race-safe customer upsert, advisory-
 * locked covers-per-slot capacity, per-table clash check.
 */
export async function createReservation(
  input: CreateReservationInput,
  employeeId: string
) {
  const reservationDate = input.reservationDate ?? athensBusinessDate();
  const reservationTime = normalizeTime(input.reservationTime);

  const today = athensBusinessDate();
  if (reservationDate < today) {
    throw new ReservationError(400, "Cannot book in the past");
  }
  const maxDate = new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000);
  if (reservationDate > athensBusinessDate(maxDate)) {
    throw new ReservationError(400, `Max ${MAX_DAYS_AHEAD} days in advance`);
  }

  let customerId: string;
  if (input.customerId) {
    const [c] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, input.customerId));
    if (!c) throw new ReservationError(400, "Unknown customer");
    customerId = c.id;
  } else {
    if (!input.customerPhone) {
      throw new ReservationError(
        400,
        "Customer name + phone or customerId required"
      );
    }
    customerId = await upsertCustomerByPhone({
      phone: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
    });
  }

  if (input.tableId) {
    const [t] = await db
      .select({ id: diningTables.id })
      .from(diningTables)
      .where(eq(diningTables.id, input.tableId));
    if (!t) throw new ReservationError(400, "Unknown table");
  }

  try {
    return await db.transaction(async (tx) => {
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

      if (!slotHasCapacity(Number(row?.total ?? 0), input.partySize, MAX_COVERS_PER_SLOT)) {
        throw new ReservationError(409, "Η ώρα είναι πλήρης — δοκιμάστε άλλη");
      }

      // The assigned table must be free at that slot.
      if (input.tableId) {
        const [clash] = await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.reservationDate, reservationDate),
              eq(reservations.reservationTime, reservationTime),
              eq(reservations.tableId, input.tableId),
              ne(reservations.status, "cancelled"),
              ne(reservations.status, "no_show")
            )
          );
        if (clash) {
          throw new ReservationError(
            409,
            "Το τραπέζι είναι ήδη κρατημένο για αυτή την ώρα"
          );
        }
      }

      const [reservation] = await tx
        .insert(reservations)
        .values({
          customerId,
          partySize: input.partySize,
          reservationDate,
          reservationTime,
          employeeId,
          specialRequests: input.specialRequests ?? null,
          tableId: input.tableId ?? null,
        })
        .returning();
      return reservation;
    });
  } catch (err) {
    if (err instanceof ReservationError) throw err;
    console.error("[RESERVATIONS] Booking failed:", err);
    throw new ReservationError(500, "Booking failed — please try again");
  }
}

export interface ReservationUpdate {
  partySize?: number;
  reservationTime?: string;
  specialRequests?: string | null;
  tableId?: string | null;
  status?: "confirmed" | "seated" | "cancelled" | "no_show";
}

/** Manual edit/status change. Status moves are only allowed from `confirmed` —
 *  once seated, adjustments happen through the order; cancelled/no_show are final. */
export async function updateReservation(
  client: ReservationClient,
  id: string,
  update: ReservationUpdate
) {
  const [current] = await client
    .select({ status: reservations.status })
    .from(reservations)
    .where(eq(reservations.id, id));
  if (!current) throw new ReservationError(404, "Not found");

  const patch: Partial<typeof reservations.$inferInsert> = {};
  if (update.partySize !== undefined) update.partySize = update.partySize;
  if (update.reservationTime !== undefined) {
    update.reservationTime = normalizeTime(update.reservationTime);
  }
  if (update.specialRequests !== undefined) {
    update.specialRequests = update.specialRequests;
  }
  if (update.tableId !== undefined) update.tableId = update.tableId;
  if (update.status && update.status !== current.status) {
    if (current.status !== "confirmed") {
      throw new ReservationError(
        409,
        `Status can only change while the reservation is confirmed (it is ${current.status})`
      );
    }
    patch.status = update.status;
  }

  if (update.reservationTime) update.reservationTime = normalizeTime(update.reservationTime);
  if (Object.keys(patch).length === 0) {
    throw new ReservationError(400, "No fields to update");
  }

  const [updated] = await client
    .update(reservations)
    .set(patch)
    .where(eq(reservations.id, id))
    .returning();
  if (!updated) throw new ReservationError(404, "Not found");
  return updated;
}

/** Order-engine hookup: mark a confirmed reservation seated when its order is sent. */
export async function markReservationSeated(
  tx: OrderTx,
  reservationId: string,
  orderId: string
) {
  const seated = await tx
    .update(reservations)
    .set({ status: "seated", orderId })
    .where(and(eq(reservations.id, reservationId), eq(reservations.status, "confirmed")))
    .returning();
  if (seated.length === 0) {
    // Two staff seated the same reservation at once — roll everything back.
    throw new ReservationError(409, "Reservation is not active");
  }
}

/** Day or range listing with customer and table names. */
export async function listReservations(
  filter: { date?: string; from?: string; to?: string }
) {
  let where;
  if (filter.date) {
    where = eq(reservations.reservationDate, filter.date);
  } else if (filter.from && filter.to) {
    where = and(
      gte(reservations.reservationDate, filter.from),
      lte(reservations.reservationDate, filter.to)
    );
  }

  return db
    .select({
      id: reservations.id,
      partySize: reservations.partySize,
      reservationDate: reservations.reservationDate,
      reservationTime: reservations.reservationTime,
      status: reservations.status,
      specialRequests: reservations.specialRequests,
      createdAt: reservations.createdAt,
      customerId: reservations.customerId,
      customerEmail: customers.email,
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
}
