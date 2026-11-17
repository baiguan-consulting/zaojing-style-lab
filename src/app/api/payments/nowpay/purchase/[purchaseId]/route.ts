import { type NextRequest, NextResponse } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { queryNowPayQuota } from "@/lib/nowpay-direct";
import {
  getNowPayPurchaseForUser,
  updateNowPayPurchaseRequest,
} from "@/lib/nowpay-store";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ purchaseId: string }> },
) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { purchaseId } = await context.params;
    const purchase = await getNowPayPurchaseForUser(purchaseId, user.id);
    if (!purchase) return NextResponse.json({ error: "购买记录不存在" }, { status: 404 });

    const quota = await queryNowPayQuota(user.id);
    const confirmed = purchase.status === "QUOTA_CONFIRMED"
      || (purchase.status !== "FAILED"
        && purchase.remainingBefore !== null
        && quota.remaining > purchase.remainingBefore);
    if (confirmed && purchase.status !== "QUOTA_CONFIRMED") {
      await updateNowPayPurchaseRequest(purchase.id, {
        status: "QUOTA_CONFIRMED",
        completedAt: new Date(),
      });
    }

    return NextResponse.json({
      purchaseId: purchase.id,
      status: confirmed ? "QUOTA_CONFIRMED" : purchase.status,
      remaining: quota.remaining,
      confirmed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "购买结果查询失败";
    const status = error instanceof AuthenticationError
      ? 401
      : message.includes("不存在") ? 404 : 503;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
