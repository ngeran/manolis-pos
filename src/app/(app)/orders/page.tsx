"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface Order {
  id: string;
  tableNumber: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
}

const statusVariant = {
  pending: "warning" as const,
  completed: "success" as const,
  cancelled: "error" as const,
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(setOrders);
  }, []);

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Order History</h1>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-10 text-outline">
          <span className="material-symbols-outlined text-[64px] block mb-3">
            receipt_long
          </span>
          <p className="text-lg">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-surface border border-outline-variant rounded-xl p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6 hover:border-primary-container transition-all"
            >
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="h-12 w-12 rounded-full bg-surface-container-low flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">
                    receipt
                  </span>
                </div>
                <div>
                  <p className="font-medium text-lg text-on-surface">
                    {order.tableNumber
                      ? `Table ${order.tableNumber}`
                      : "Takeaway"}
                  </p>
                  <p className="text-xs font-medium text-outline">
                    {new Date(order.createdAt).toLocaleString("el-GR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Badge variant={statusVariant[order.status as keyof typeof statusVariant] ?? "default"}>
                  {order.status}
                </Badge>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(order.totalCents)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
