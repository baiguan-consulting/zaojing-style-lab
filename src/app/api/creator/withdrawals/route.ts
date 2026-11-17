import { type NextRequest } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { createCreatorWithdrawal } from "@/lib/creator-store";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const body = await request.json() as {
      amountYuan?: number;
      payeeName?: string;
      alipayAccount?: string;
      contactEmail?: string;
    };
    const amountFen = Math.round(Number(body.amountYuan ?? 0) * 100);
    const withdrawal = await createCreatorWithdrawal({
      userId: user.id,
      amountFen,
      payeeName: String(body.payeeName ?? ""),
      alipayAccount: String(body.alipayAccount ?? ""),
      contactEmail: String(body.contactEmail || user.email),
    });
    return Response.json({ withdrawal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提现申请提交失败";
    const status = error instanceof AuthenticationError ? 401 : message.includes("请求来源") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
