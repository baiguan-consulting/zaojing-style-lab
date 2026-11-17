import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import {
  authenticateRequest,
  normalizeEmail,
} from "./auth";

export class AdminAuthorizationError extends Error {
  constructor(message: string, public readonly status: 401 | 403 = 403) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

function configuredAdminEmails() {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) throw new Error("ADMIN_EMAILS 尚未配置");
  const emails = raw.split(",").map((item) => normalizeEmail(item));
  if (!emails.length) throw new Error("ADMIN_EMAILS 尚未配置");
  return new Set(emails);
}

function isAdminEmail(email: string) {
  return configuredAdminEmails().has(normalizeEmail(email));
}

function hasValidAdminApiToken(request: NextRequest) {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function requireAdminApiAccess(request: NextRequest) {
  if (hasValidAdminApiToken(request)) return { type: "api-token" as const };
  const user = await authenticateRequest(request);
  if (!user) throw new AdminAuthorizationError("请先登录管理员账户", 401);
  if (!isAdminEmail(user.email)) throw new AdminAuthorizationError("管理员接口未授权", 403);
  return { type: "session" as const, user };
}

export function requireAdminEmail(email: string) {
  if (!isAdminEmail(email)) throw new AdminAuthorizationError("管理员页面未授权", 403);
}
