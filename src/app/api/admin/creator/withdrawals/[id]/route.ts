import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { updateCreatorWithdrawal } from "@/lib/creator-store";
import { requireSameOrigin } from "@/lib/payment-session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdminApiAccess(request);
    const { id } = await params;
    const body = await request.json() as {
      action?: "approve" | "paid" | "reject";
      note?: string;
      transferReference?: string;
    };
    const adminEmail = admin.type === "session" ? admin.user.email : "admin-api-token";
    if (!body.action || !["approve", "paid", "reject"].includes(body.action)) {
      return Response.json({ error: "提现处理操作无效" }, { status: 400 });
    }
    const withdrawal = await updateCreatorWithdrawal({
      withdrawalId: id,
      action: body.action,
      adminEmail,
      note: body.note,
      transferReference: body.transferReference,
    });
    return Response.json({ withdrawal });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "提现处理失败" },
      { status: error instanceof AdminAuthorizationError ? error.status : 400 },
    );
  }
}
