import { type NextRequest, NextResponse } from "next/server";

import { clearAuthSession, revokeRequestSession } from "@/lib/auth";
import { clearPaymentSession, requireSameOrigin } from "@/lib/payment-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "请求来源校验失败" },
      { status: 403 },
    );
  }
  try {
    await revokeRequestSession(request);
  } catch {
    // Clear browser state even if the database is temporarily unavailable.
  }
  const response = NextResponse.json({ ok: true });
  clearAuthSession(response);
  clearPaymentSession(response);
  return response;
}
