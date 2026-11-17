import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { testBoxAIConnection } from "@/lib/boxai";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    return Response.json(await testBoxAIConnection());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "BoxAI 连接失败" },
      {
        status: error instanceof AdminAuthorizationError
          ? error.status
          : error instanceof Error && error.message.includes("来源校验") ? 403 : 502,
      },
    );
  }
}
