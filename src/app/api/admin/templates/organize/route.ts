import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/payment-session";
import {
  organizeTemplateWithAI,
  TemplateAIUnavailableError,
} from "@/lib/template-ai";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "管理员接口未授权" },
      {
        status: error instanceof AdminAuthorizationError
          ? error.status
          : 403,
      },
    );
  }

  let rawText = "";
  try {
    const body = await request.json() as { rawText?: unknown };
    rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  } catch {
    return Response.json({ error: "请求内容必须是有效的 JSON" }, { status: 400 });
  }

  if (rawText.length < 20) {
    return Response.json({ error: "请先粘贴至少 20 个字符的原始文案或提示词" }, { status: 400 });
  }
  if (rawText.length > 30_000) {
    return Response.json({ error: "原始文案不能超过 30000 个字符" }, { status: 400 });
  }

  try {
    return Response.json(await organizeTemplateWithAI(rawText));
  } catch (error) {
    if (error instanceof TemplateAIUnavailableError) {
      return Response.json(
        { error: error.message, attempts: error.attempts },
        { status: 502 },
      );
    }
    return Response.json(
      { error: "AI 模板整理暂时不可用，请稍后重试或使用规则整理" },
      { status: 502 },
    );
  }
}
