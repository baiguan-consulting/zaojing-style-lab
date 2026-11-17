import { type NextRequest } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { getCreatorDashboard } from "@/lib/creator-store";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    return Response.json(await getCreatorDashboard(user.id));
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 503;
    return Response.json({ error: error instanceof Error ? error.message : "创作者数据暂不可用" }, { status });
  }
}
