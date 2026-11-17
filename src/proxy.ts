import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE } from "@/lib/locale";

export function proxy(request: NextRequest) {
  const destination = request.nextUrl.clone();
  destination.pathname = request.nextUrl.pathname.slice(3) || "/";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-zaojing-locale", "en");

  const response = NextResponse.rewrite(destination, {
    request: { headers: requestHeaders },
  });
  response.cookies.set(LOCALE_COOKIE, "en", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "medium",
  });
  return response;
}

export const config = {
  matcher: [
    "/en",
    "/en/templates/:path*",
    "/en/credits/:path*",
    "/en/login",
    "/en/payment/:path*",
  ],
};
