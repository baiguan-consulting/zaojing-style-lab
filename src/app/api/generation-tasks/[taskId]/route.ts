import { type NextRequest, NextResponse } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { confirmNowPayConsumption, publicNowPayAttempt } from "@/lib/nowpay-service";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/generation-tasks/[taskId]">,
) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { taskId } = await context.params;
    const attempt = await confirmNowPayConsumption(taskId, user.id);
    const body = publicNowPayAttempt(attempt);
    if (!body) return NextResponse.json({ error: "创作任务不存在" }, { status: 404 });
    if (attempt.consumption.status === "FAILED") {
      return NextResponse.json(body, { status: body.paymentRequired ? 402 : 409 });
    }
    if (attempt.consumption.status !== "SUCCEEDED") return NextResponse.json(body, { status: 202 });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "创作任务查询失败";
    const status = error instanceof AuthenticationError ? 401 : message.includes("不存在") ? 404 : 503;
    return NextResponse.json({ error: message, loginRequired: status === 401 }, { status });
  }
}
