import { type NextRequest } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { saveCreatorProfile } from "@/lib/creator-store";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const body = await request.json() as { displayName?: string; bio?: string; acceptTerms?: boolean };
    if (body.acceptTerms !== true) {
      return Response.json({ error: "请先确认创作者协议与素材权利声明" }, { status: 400 });
    }
    const profile = await saveCreatorProfile({
      userId: user.id,
      displayName: String(body.displayName ?? ""),
      bio: String(body.bio ?? ""),
    });
    return Response.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创作者资料保存失败";
    const status = error instanceof AuthenticationError ? 401 : message.includes("请求来源") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
