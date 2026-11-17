import { type NextRequest, NextResponse } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { getCreditPackage } from "@/lib/payment-packages";
import { publicOrder } from "@/lib/payment-service";
import { requireSameOrigin } from "@/lib/payment-session";
import { createPaymentOrder, getReusablePaymentOrder } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as { packageId?: string };
    const creditPackage = getCreditPackage(String(body.packageId ?? ""));
    if (!creditPackage) {
      return NextResponse.json({ error: "创作次数套餐不存在" }, { status: 400 });
    }

    const order = await getReusablePaymentOrder(user.id, creditPackage.id)
      ?? await createPaymentOrder({
        userId: user.id,
        packageId: creditPackage.id,
        subject: `造境·${creditPackage.name}`,
        amountFen: creditPackage.amountFen,
        credits: creditPackage.credits,
      });

    // The order is persisted before checkout so the buyer can review a real,
    // auditable transaction record even if the payment provider is unavailable.
    return NextResponse.json({ order: publicOrder(order) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "支付订单创建失败";
    const status = error instanceof AuthenticationError
      ? 401
      : message.includes("来源校验") ? 403 : 400;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
