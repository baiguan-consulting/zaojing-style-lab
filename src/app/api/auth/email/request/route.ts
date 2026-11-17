import { type NextRequest, NextResponse } from "next/server";

import { requestLoginCode } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/payment-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = (await request.json()) as { email?: string };
    const result = await requestLoginCode(request, String(body.email ?? ""));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "验证码暂时无法发送";
    const status = message.includes("来源校验失败")
      ? 403
      : message.includes("尚未配置") || message.includes("数据库")
      ? 503
      : message.includes("请输入有效")
        ? 400
        : message.includes("上限") || message.includes("频繁")
          ? 429
          : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
