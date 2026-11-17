import { type NextRequest, NextResponse } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import {
  createNowPayPurchase,
  getNowPayCallbackUrl,
  queryNowPayProduct,
  queryNowPayQuota,
} from "@/lib/nowpay-direct";
import {
  createNowPayPurchaseRequest,
  updateNowPayPurchaseRequest,
} from "@/lib/nowpay-store";
import { requireSameOrigin } from "@/lib/payment-session";

export const runtime = "nodejs";

function parseProviderTime(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value.replace(" ", "T") + "+08:00");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function POST(request: NextRequest) {
  let purchaseId: string | undefined;
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as { skuId?: string };
    const skuId = String(body.skuId ?? "").trim();
    const [product, quota] = await Promise.all([
      queryNowPayProduct(),
      queryNowPayQuota(user.id),
    ]);
    if (product.capabilityStatus !== "ENABLED") {
      return NextResponse.json({ error: `即刻收商品当前不可购买（${product.capabilityStatus}）` }, { status: 409 });
    }
    const selected = skuId ? product.options.find((item) => item.skuId === skuId) : undefined;
    if (skuId && !selected) return NextResponse.json({ error: "所选次数包档位不存在" }, { status: 400 });

    const purchase = await createNowPayPurchaseRequest({
      userId: user.id,
      externalBuyerId: user.id,
      skuId: selected?.skuId,
      remainingBefore: quota.remaining,
      optionSnapshot: selected ? {
        skuId: selected.skuId,
        label: selected.label,
        quota: selected.quota,
        amountFen: selected.amountFen,
      } : undefined,
    });
    purchaseId = purchase.id;
    const result = await createNowPayPurchase({
      outRequestNo: purchase.outRequestNo,
      externalBuyerId: user.id,
      skuId: selected?.skuId,
      callbackUrl: getNowPayCallbackUrl(purchase.id),
    });
    await updateNowPayPurchaseRequest(purchase.id, {
      status: "LINK_CREATED",
      expiresAt: parseProviderTime(result.expireTime),
    });
    return NextResponse.json({
      purchaseId: purchase.id,
      createdAt: purchase.createdAt.toISOString(),
      purchaseUrl: result.purchaseUrl,
      purchaseQrCode: result.purchaseQrCode,
      expireTime: result.expireTime,
    });
  } catch (error) {
    if (purchaseId) {
      await updateNowPayPurchaseRequest(purchaseId, { status: "FAILED" }).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "即刻收购买入口创建失败";
    const status = error instanceof AuthenticationError
      ? 401
      : message.includes("来源校验") ? 403 : message.includes("尚未配置") || message.includes("校验") ? 503 : 400;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
