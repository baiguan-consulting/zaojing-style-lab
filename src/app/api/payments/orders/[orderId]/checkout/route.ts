import { type NextRequest, NextResponse } from "next/server";

import { assertAlipayCheckoutAvailable, createAlipayPaymentHtml } from "@/lib/alipay";
import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/payment-session";
import { getOrderForUser, updateOrderStatus } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/payments/orders/[orderId]/checkout">,
) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const { orderId } = await context.params;
    const order = await getOrderForUser(orderId, user.id);
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    if (!["CREATED", "PENDING_PAYMENT"].includes(order.status)) {
      return NextResponse.json({ error: "当前订单状态不能继续支付" }, { status: 409 });
    }

    assertAlipayCheckoutAvailable();
    const paymentHtml = createAlipayPaymentHtml(order);
    await updateOrderStatus(order.id, "PENDING_PAYMENT");
    return NextResponse.json({ paymentHtml });
  } catch (error) {
    const message = error instanceof Error ? error.message : "支付宝支付发起失败";
    const status = error instanceof AuthenticationError
      ? 401
      : message.includes("来源校验") ? 403 : message.includes("配置") || message.includes("校验") ? 503 : 400;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
