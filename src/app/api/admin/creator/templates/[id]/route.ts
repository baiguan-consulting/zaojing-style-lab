import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { mutateTemplates } from "@/lib/template-store";
import { requireSameOrigin } from "@/lib/payment-session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdminApiAccess(request);
    const { id } = await params;
    const body = await request.json() as { action?: string; reason?: string };
    const adminEmail = admin.type === "session" ? admin.user.email : "admin-api-token";
    if (!["approve", "reject", "suspend"].includes(String(body.action))) {
      return Response.json({ error: "审核操作无效" }, { status: 400 });
    }

    const reason = String(body.reason ?? "").trim().slice(0, 500);
    if (body.action === "reject" && !reason) {
      return Response.json({ error: "驳回时请填写原因" }, { status: 400 });
    }
    const result = await mutateTemplates((templates) => {
      const index = templates.findIndex((item) => item.id === id && item.ownerType === "creator");
      if (index < 0) throw new Error("创作者模板不存在");
      const current = templates[index];
      if (body.action === "approve" && current.status !== "pending_review") {
        throw new Error("只有待审核模板可以发布");
      }
      const status = body.action === "approve"
        ? "published" as const
        : body.action === "reject"
          ? "rejected" as const
          : "suspended" as const;
      templates[index] = {
        ...current,
        status,
        reviewReason: reason || undefined,
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminEmail,
        updatedAt: new Date().toISOString(),
      };
      return { templates, result: { id, status } };
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "模板审核失败" },
      { status: error instanceof AdminAuthorizationError ? error.status : 403 },
    );
  }
}
