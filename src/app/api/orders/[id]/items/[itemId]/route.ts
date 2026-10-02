import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { itemActionSchema } from "@/lib/validations";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import {
  isTerminalStatus,
  loadOrderDetail,
  OrderError,
  orderErrorResponse,
  recomputeOrderStatus,
  recomputeTotalCents,
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
  const action = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // Lock the order row — serializes all per-order mutations.
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
      if (!order) throw new OrderError(404, "Order not found");

      const [item] = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, id)));
      if (!item) throw new OrderError(404, "Item not found");

      switch (action.action) {
        case "bump": {
          if (item.status !== "queued") {
            throw new OrderError(409, `Only queued items can be bumped (item is ${item.status})`);
          }
          await tx
            .update(orderItems)
            .set({ status: "done", doneAt: new Date() })
            .where(eq(orderItems.id, itemId));
          break;
        }
        case "unbump": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          if (item.status !== "done") {
            throw new OrderError(409, `Only done items can be unbumped (item is ${item.status})`);
          }
          await tx
            .update(orderItems)
            .set({ status: "queued", doneAt: null })
            .where(eq(orderItems.id, itemId));
          break;
        }
        case "fire": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          if (item.status !== "held") {
            throw new OrderError(409, `Only held items can be fired (item is ${item.status})`);
          }
          await tx
            .update(orderItems)
            .set({ status: "queued", firedAt: new Date() })
            .where(eq(orderItems.id, itemId));
          break;
        }
        case "void": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          if (item.status === "voided") throw new OrderError(409, "Item already voided");
          if (action.reason === "other" && !action.note?.trim()) {
            throw new OrderError(400, "A note is required when the reason is 'other'");
          }
          await tx
            .update(orderItems)
            .set({
              status: "voided",
              voidedReason: action.reason,
              voidedNote: action.note ?? null,
              voidedBy: user.id,
              voidedAt: new Date(),
            })
            .where(eq(orderItems.id, itemId));
          break;
        }
      }

      await recomputeOrderStatus(tx, id);
      await recomputeTotalCents(tx, id);
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
