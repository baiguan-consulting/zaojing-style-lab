import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { testAlipayProductionConnection } from "@/lib/alipay";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    return Response.json(await testAlipayProductionConnection());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "支付宝连接测试失败" },
      {
        status: error instanceof AdminAuthorizationError
          ? error.status
          : error instanceof Error && error.message.includes("来源校验") ? 403 : 502,
      },
    );
  }
}
