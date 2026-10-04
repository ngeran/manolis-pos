import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import { createCustomerSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const search = new URL(request.url).searchParams.get("search");
  if (search && search.trim().length >= 2) {
    const q = `%${search.trim()}%`;
    const results = await db
      .select()
      .from(customers)
      .where(
        or(
          ilike(customers.firstName, q),
          ilike(customers.lastName, q),
          ilike(customers.phone, q),
          ilike(customers.email, q)
        )
      )
      .limit(20);
    return NextResponse.json(results);
  }

  const all = await db
    .select()
    .from(customers)
    .orderBy(sql`${customers.lastVisit} DESC NULLS LAST`)
    .limit(100);
  return NextResponse.json(all);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.phone, parsed.data.phone))
    .limit(1);
  if (existing.length) {
    return NextResponse.json(
      { error: "A customer with this phone already exists" },
      { status: 409 }
    );
  }

  const [row] = await db.insert(customers).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
