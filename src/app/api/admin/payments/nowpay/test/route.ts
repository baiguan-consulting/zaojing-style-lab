import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { queryNowPayProduct } from "@/lib/nowpay-direct";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
    const product = await queryNowPayProduct();
    return Response.json({
      connected: true,
      capabilityStatus: product.capabilityStatus,
      billingMode: product.billingMode,
      quotaUnit: product.quotaUnit,
      optionCount: product.options.length,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "即刻收商品查询失败" },
      {
        status: error instanceof AdminAuthorizationError
          ? error.status
          : error instanceof Error && error.message.includes("来源校验") ? 403 : 502,
      },
    );
  }
}
