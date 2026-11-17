import { type NextRequest, NextResponse } from "next/server";

import { refundAlipayTrade } from "@/lib/alipay";
import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { CREDIT_UNIT_PRICE_FEN } from "@/lib/payment-packages";
import { requireSameOrigin } from "@/lib/payment-session";
import {
  getOrderById,
  prepareRefund,
  updateRefundStatus,
} from "@/lib/payment-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/admin/payments/orders/[orderId]/refund">,
) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    const { orderId } = await context.params;
    const body = (await request.json()) as {
      amountFen?: number;
      reason?: string;
      idempotencyKey?: string;
    };
    if (!Number.isInteger(body.amountFen) || Number(body.amountFen) < 1) {
      return NextResponse.json({ error: "amountFen 必须是正整数" }, { status: 400 });
    }
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: "idempotencyKey 格式不正确" }, { status: 400 });
    }
    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

    const refund = await prepareRefund({
      orderId,
      idempotencyKey,
      amountFen: Number(body.amountFen),
      reason: String(body.reason ?? "用户退款").slice(0, 200),
      unitPriceFen: CREDIT_UNIT_PRICE_FEN,
    });
    if (refund.status === "SUCCEEDED" || refund.status === "FAILED") {
      return NextResponse.json({ refundId: refund.id, status: refund.status });
    }

    try {
      const result = await refundAlipayTrade(order, refund);
      const status = result.fund_change === "Y" ? "SUCCEEDED" : "UNKNOWN";
      const updated = await updateRefundStatus(refund.id, status);
      return NextResponse.json({ refundId: updated.id, status: updated.status });
    } catch {
      const updated = await updateRefundStatus(refund.id, "UNKNOWN");
      return NextResponse.json(
        { refundId: updated.id, status: updated.status, message: "退款结果待查询确认" },
        { status: 202 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "退款请求失败";
    const status = error instanceof AdminAuthorizationError
      ? error.status
      : message.includes("来源校验") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
