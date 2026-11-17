import { type NextRequest, NextResponse } from "next/server";

import { closeAlipayTrade } from "@/lib/alipay";
import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { syncOrderWithAlipay } from "@/lib/payment-service";
import { requireSameOrigin } from "@/lib/payment-session";
import { getOrderById, updateOrderStatus } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/admin/payments/orders/[orderId]/close">,
) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    const { orderId } = await context.params;
    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status)) {
      return NextResponse.json({ error: "已支付订单不能关闭" }, { status: 409 });
    }
    const refreshed = await syncOrderWithAlipay(order);
    if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(refreshed.status)) {
      return NextResponse.json({ error: "订单已经支付，不能关闭" }, { status: 409 });
    }
    await closeAlipayTrade(refreshed);
    const closed = await updateOrderStatus(order.id, "CLOSED");
    return NextResponse.json({ id: closed.id, status: closed.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "关闭订单失败";
    const status = error instanceof AdminAuthorizationError
      ? error.status
      : message.includes("来源校验") ? 403 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
