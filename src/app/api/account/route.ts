import { type NextRequest, NextResponse } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { getRewardCreditBalance } from "@/lib/creator-store";
import { isNowPayDirectEnabled, queryNowPayProduct, queryNowPayQuota } from "@/lib/nowpay-direct";
import { listNowPayPurchases } from "@/lib/nowpay-store";
import { getAccount } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    if (isNowPayDirectEnabled()) {
      const [product, quota, purchases, rewardCredits] = await Promise.all([
        queryNowPayProduct(),
        queryNowPayQuota(user.id),
        listNowPayPurchases(user.id),
        getRewardCreditBalance(user.id),
      ]);
      return NextResponse.json({
        paymentMode: "NOWPAY_DIRECT",
        balanceCredits: quota.remaining,
        rewardCredits,
        quota: {
          total: quota.total,
          used: quota.used,
          remaining: quota.remaining,
          asOfTime: quota.asOfTime,
        },
        product: {
          capabilityStatus: product.capabilityStatus,
          billingMode: product.billingMode,
          quotaUnit: product.quotaUnit,
          options: [...product.options]
            .sort((left, right) => (left.quota ?? Number.MAX_SAFE_INTEGER) - (right.quota ?? Number.MAX_SAFE_INTEGER))
            .map((option) => ({
              skuId: option.skuId,
              label: option.label,
              quota: option.quota,
              amountFen: option.amountFen,
            })),
        },
        purchases: purchases.map((item) => ({
          id: item.id,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          option: item.optionSnapshot,
        })),
        orders: [],
        user: { email: user.email, emailMasked: user.emailMasked },
      });
    }
    const [account, rewardCredits] = await Promise.all([
      getAccount(user.id),
      getRewardCreditBalance(user.id),
    ]);
    return NextResponse.json({
      paymentMode: "LEGACY",
      balanceCredits: account.balanceCredits,
      rewardCredits,
      orders: account.orders,
      user: { email: user.email, emailMasked: user.emailMasked },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "账户服务暂不可用";
    const status = error instanceof AuthenticationError ? 401 : 503;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
