import { type NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE, normalizeLocale } from "@/lib/locale";
import { requireSameOrigin } from "@/lib/payment-session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let locale = "zh";
  try {
    const body = await request.json() as { locale?: unknown };
    if (body.locale !== "zh" && body.locale !== "en") {
      return Response.json({ error: "Unsupported locale" }, { status: 400 });
    }
    locale = normalizeLocale(body.locale);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "medium",
  });
  return response;
}
