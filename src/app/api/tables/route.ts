import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { diningTables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  createTableSchema,
  updateTableSchema,
  deleteTableSchema,
} from "@/lib/validations";
import { getSessionUser, isAdminUser, unauthorized, forbidden } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const result = await db.select().from(diningTables).orderBy(diningTables.sortOrder);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isAdminUser(user)) return forbidden();

  const body = await request.json();
  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [table] = await db.insert(diningTables).values(parsed.data).returning();
    return NextResponse.json(table, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A table with this name already exists" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isAdminUser(user)) return forbidden();

  const body = await request.json();
  const parsed = updateTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(diningTables)
      .set(updates)
      .where(eq(diningTables.id, id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "A table with this name already exists" }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isAdminUser(user)) return forbidden();

  const body = await request.json();
  const parsed = deleteTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [deleted] = await db
    .delete(diningTables)
    .where(eq(diningTables.id, parsed.data.id))
    .returning();
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
