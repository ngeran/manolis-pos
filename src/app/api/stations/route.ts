import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stations } from "@/lib/db/schema";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const result = await db.select().from(stations).orderBy(stations.sortOrder);
  return NextResponse.json(result);
}
