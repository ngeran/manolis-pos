import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { itemActionSchema } from "@/lib/validations";
import { getSessionUser, isAdminUser, unauthorized } from "@/lib/api-auth";
import {
  applyItemAction,
  loadOrderDetail,
  OrderError,
  orderErrorResponse,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, itemId } = await params;
  const body = await request.json();
  const parsed = itemActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      await applyItemAction(tx, {
        orderId: id,
        itemId,
        actor: { id: user.id, isAdmin: isAdminUser(user) },
        action: parsed.data,
      });
    });

    const detail = await loadOrderDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    const handled = orderErrorResponse(err);
    if (handled) return handled;
    throw err;
  }
}
