import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { orderActionSchema } from "@/lib/validations";
import { getSessionUser, isAdminUser, unauthorized } from "@/lib/api-auth";
import {
  isTerminalStatus,
  loadOrderDetail,
  OrderError,
  orderErrorResponse,
  recomputeOrderStatus,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const detail = await loadOrderDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = orderActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const action = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
      if (!order) throw new OrderError(404, "Order not found");

      switch (action.action) {
        case "fire": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          await tx
            .update(orderItems)
            .set({ status: "queued", firedAt: new Date() })
            .where(and(eq(orderItems.orderId, id), eq(orderItems.status, "held")));
          break;
        }
        case "rush": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          await tx
            .update(orders)
            .set({ priority: true, priorityAt: new Date() })
            .where(eq(orders.id, id));
          break;
        }
        case "unrush": {
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          await tx
            .update(orders)
            .set({ priority: false, priorityAt: null })
            .where(eq(orders.id, id));
          break;
        }
        case "serve": {
          if (order.status !== "ready") {
            throw new OrderError(409, `Cannot serve an order that is ${order.status}`);
          }
          await tx
            .update(orders)
            .set({ status: "served", servedAt: new Date() })
            .where(eq(orders.id, id));
          break;
        }
        case "paid": {
          if (order.status !== "served") {
            throw new OrderError(409, `Cannot close an order that is ${order.status}`);
          }
          await tx
            .update(orders)
            .set({ status: "paid", paidAt: new Date() })
            .where(eq(orders.id, id));
          break;
        }
        case "cancel": {
          if (!isAdminUser(user)) {
            throw new OrderError(403, "Only admins can cancel an order");
          }
          if (isTerminalStatus(order.status)) throw new OrderError(409, "Order already closed");
          if (action.reason === "other" && !action.note?.trim()) {
            throw new OrderError(400, "A note is required when the reason is 'other'");
          }
          await tx
            .update(orders)
            .set({
              status: "cancelled",
              cancelledAt: new Date(),
              cancelledBy: user.id,
              cancelReason: action.reason,
              cancelNote: action.note ?? null,
            })
            .where(eq(orders.id, id));
          break;
        }
      }

      if (action.action === "fire") {
        await recomputeOrderStatus(tx, id);
      }
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
