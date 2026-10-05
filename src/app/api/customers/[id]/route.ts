import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateCustomerSchema } from "@/lib/validations";
import { getSessionUser, isAdminUser, forbidden, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  for (const key of ["email", "dietaryNotes"]) {
    if (body[key] === "") delete body[key];
  }
  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".") || "δεδομένα"}: ${first.message}` : "Invalid data" },
      { status: 400 }
    );
  }

  const updates = { ...parsed.data };
  // Explicit nulls clear a field; "" was dropped before parsing.
  if (body.email === "") updates.email = null;
  if (body.dietaryNotes === "") updates.dietaryNotes = null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A customer with this phone already exists" },
        { status: 409 }
      );
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
  if (!isAdminUser(user)) return forbidden();

  const { id } = await params;
  const [deleted] = await db
    .delete(customers)
    .where(eq(customers.id, id))
    .returning();
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
