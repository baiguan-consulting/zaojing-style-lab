import { type NextRequest, NextResponse } from "next/server";

import { queryAlipayRefund } from "@/lib/alipay";
import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/payment-session";
import {
  getOrderById,
  getRefundById,
  updateRefundStatus,
} from "@/lib/payment-store";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/admin/payments/refunds/[refundId]">,
) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    const { refundId } = await context.params;
    const refund = await getRefundById(refundId);
    if (!refund) return NextResponse.json({ error: "退款记录不存在" }, { status: 404 });
    if (refund.status === "SUCCEEDED" || refund.status === "FAILED") {
      return NextResponse.json({ refundId: refund.id, status: refund.status });
    }
    const retryAfterSeconds = Math.ceil(
      (10_000 - (Date.now() - new Date(refund.createdAt).getTime())) / 1000,
    );
    if (retryAfterSeconds > 0) {
      return NextResponse.json(
        { refundId: refund.id, status: refund.status, retryAfterSeconds },
        { status: 202, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
    const order = await getOrderById(refund.orderId);
    if (!order) return NextResponse.json({ error: "退款关联订单不存在" }, { status: 404 });

    const result = await queryAlipayRefund(order, refund);
    const status = result.refund_status === "REFUND_SUCCESS" ? "SUCCEEDED" : "UNKNOWN";
    const updated = await updateRefundStatus(refund.id, status);
    return NextResponse.json({ refundId: updated.id, status: updated.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "退款查询失败";
    const status = error instanceof AdminAuthorizationError
      ? error.status
      : message.includes("来源校验") ? 403 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
