import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

export const PAYMENT_SESSION_COOKIE = "zaojing_payment_session";

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("APP_SESSION_SECRET 必须配置为至少 32 个字符的随机字符串");
  }
  return secret;
}

function signatureFor(userId: string) {
  return createHmac("sha256", getSessionSecret()).update(userId).digest("base64url");
}

function parseSession(value: string | undefined) {
  if (!value) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return undefined;
  const userId = value.slice(0, separator);
  const provided = value.slice(separator + 1);
  const expected = signatureFor(userId);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return undefined;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return undefined;
  return /^[a-f0-9-]{36}$/i.test(userId) ? userId : undefined;
}

export function readPaymentUserId(request: NextRequest) {
  return parseSession(request.cookies.get(PAYMENT_SESSION_COOKIE)?.value);
}

export function clearPaymentSession(response: NextResponse) {
  response.cookies.set(PAYMENT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedOrigins = new Set([request.nextUrl.origin]);
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (appBaseUrl) {
    try {
      allowedOrigins.add(new URL(appBaseUrl).origin);
    } catch {
      throw new Error("APP_BASE_URL 配置无效");
    }
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new Error("请求来源校验失败");
  }
  if (!allowedOrigins.has(requestOrigin)) {
    throw new Error("请求来源校验失败");
  }
}
