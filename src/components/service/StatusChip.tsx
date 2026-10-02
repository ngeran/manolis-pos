import { Badge } from "@/components/ui/Badge";
import { orderStatusMeta } from "@/lib/kitchen";
import type { OrderStatus } from "@/lib/db/schema";

const variant: Record<OrderStatus, "default" | "success" | "warning" | "error"> = {
  sent: "warning",
  preparing: "warning",
  ready: "success",
  served: "default",
  paid: "success",
  cancelled: "error",
};

export function StatusChip({ status }: { status: OrderStatus }) {
  return <Badge variant={variant[status]}>{orderStatusMeta[status]?.el ?? status}</Badge>;
}
