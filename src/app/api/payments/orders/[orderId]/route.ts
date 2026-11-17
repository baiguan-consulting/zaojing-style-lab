import { type NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth";
import { publicOrder, syncOrderWithAlipay } from "@/lib/payment-service";
import { getOrderForUser } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext<"/api/payments/orders/[orderId]">) {
  let user;
  try {
    user = await requireAuthenticatedUser(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "账户服务暂不可用";
    if (message.includes("数据库")) return NextResponse.json({ error: message }, { status: 503 });
    return NextResponse.json({ error: message, loginRequired: true }, { status: 401 });
  }
  if (!user) return NextResponse.json({ error: "请先登录后查看订单", loginRequired: true }, { status: 401 });
  const { orderId } = await context.params;
  const order = await getOrderForUser(orderId, user.id);
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

  if (order.status === "CREATED" || order.status === "PENDING_PAYMENT") {
    try {
      return NextResponse.json({ ...publicOrder(await syncOrderWithAlipay(order)), accountEmail: user.email });
    } catch {
      return NextResponse.json({ ...publicOrder(order), accountEmail: user.email, providerCheckPending: true });
    }
  }
  return NextResponse.json({ ...publicOrder(order), accountEmail: user.email });
}
