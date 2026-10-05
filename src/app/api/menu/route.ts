import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { menuItems, categories, stations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createMenuItemSchema, updateMenuItemSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: menuItems.id,
      nameEl: menuItems.nameEl,
      nameEn: menuItems.nameEn,
      descriptionEl: menuItems.descriptionEl,
      descriptionEn: menuItems.descriptionEn,
      priceCents: menuItems.priceCents,
      pricingType: menuItems.pricingType,
      available: menuItems.available,
      imageUrl: menuItems.imageUrl,
      categoryId: menuItems.categoryId,
      categoryNameEl: categories.nameEl,
      categoryNameEn: categories.nameEn,
      stationId: menuItems.stationId,
      stationSlug: stations.slug,
      stationNameEl: stations.nameEl,
      stationNameEn: stations.nameEn,
      modifierOptions: menuItems.modifierOptions,
    })
    .from(menuItems)
    .leftJoin(categories, eq(menuItems.categoryId, categories.id))
    .leftJoin(stations, eq(menuItems.stationId, stations.id));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [item] = await db.insert(menuItems).values(parsed.data).returning();
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, ...body } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const parsed = updateMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(menuItems)
    .set(parsed.data)
    .where(eq(menuItems.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(menuItems).where(eq(menuItems.id, id));
  return NextResponse.json({ success: true });
}
