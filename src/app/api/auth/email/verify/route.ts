import { type NextRequest, NextResponse } from "next/server";

import { attachAuthSession, AuthenticationError, verifyLoginCode } from "@/lib/auth";
import {
  clearPaymentSession,
  readPaymentUserId,
  requireSameOrigin,
} from "@/lib/payment-session";
import { mergePaymentUser } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = (await request.json()) as { email?: string; code?: string };
    const legacyPaymentUserId = readPaymentUserId(request);
    const result = await verifyLoginCode(
      request,
      String(body.email ?? ""),
      String(body.code ?? ""),
    );
    await mergePaymentUser(legacyPaymentUserId, result.user.id);

    const response = NextResponse.json({ user: result.user });
    attachAuthSession(response, result.token);
    clearPaymentSession(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败，请稍后重试";
    const status = error instanceof AuthenticationError ? 400 : message.includes("数据库") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
