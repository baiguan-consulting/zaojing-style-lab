import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { convertEarningsToCredits } from "@/lib/creator-store";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const body = await request.json() as { credits?: number; idempotencyKey?: string };
    const result = await convertEarningsToCredits({
      userId: user.id,
      credits: Number(body.credits ?? 0),
      idempotencyKey: String(body.idempotencyKey || randomUUID()),
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "兑换失败";
    const status = error instanceof AuthenticationError ? 401 : message.includes("请求来源") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
