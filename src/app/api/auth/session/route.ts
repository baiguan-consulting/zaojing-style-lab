import { type NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ authenticated: false });
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, emailMasked: user.emailMasked, locale: user.locale },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录状态暂不可用";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
