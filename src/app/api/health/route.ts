import { sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await getDatabase().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: noStoreHeaders });
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
