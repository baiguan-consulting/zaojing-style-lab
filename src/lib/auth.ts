import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { and, count, desc, eq, gt, gte, inArray, isNull } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/db/client";
import { authIdentities, otpChallenges, sessions, users, wallets } from "@/db/schema";
import { sendLoginCode } from "./email";

export const AUTH_SESSION_COOKIE = "zaojing_auth_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_DAILY_EMAIL_LIMIT = 5;
const OTP_DAILY_IP_LIMIT = 20;

export type AuthenticatedUser = {
  id: string;
  email: string;
  emailMasked: string;
  locale: string;
  sessionId: string;
};

export class AuthenticationError extends Error {
  constructor(message = "请先登录后再继续") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function getAppSecret() {
  const secret = process.env.APP_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("APP_SESSION_SECRET 必须配置为至少 32 个字符的随机字符串");
  }
  return secret;
}

function hmac(value: string) {
  return createHmac("sha256", getAppSecret()).update(value).digest("hex");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function codeHash(challengeId: string, code: string) {
  return hmac(`otp:${challengeId}:${code}`);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function requestFingerprint(request: NextRequest) {
  return {
    ipHash: hmac(`ip:${requestIp(request)}`),
    userAgentHash: hmac(`ua:${request.headers.get("user-agent") || "unknown"}`),
  };
}

export function normalizeEmail(input: string) {
  const email = input.trim().toLowerCase();
  const [localPart, domain, ...rest] = email.split("@");
  if (
    rest.length > 0
    || !localPart
    || !domain
    || localPart.length > 64
    || email.length > 254
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain)
  ) {
    throw new Error("请输入有效的邮箱地址");
  }
  return email;
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function requestLoginCode(request: NextRequest, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const db = getDatabase();
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - OTP_RESEND_SECONDS * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const destinationHash = hmac(`email:${email}`);
  const { ipHash } = requestFingerprint(request);

  const [recent, emailCount, ipCount] = await Promise.all([
    db
      .select({ createdAt: otpChallenges.createdAt })
      .from(otpChallenges)
      .where(and(
        eq(otpChallenges.destinationHash, destinationHash),
        inArray(otpChallenges.deliveryStatus, ["PENDING", "SENT"]),
        gte(otpChallenges.createdAt, minuteAgo),
      ))
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1),
    db
      .select({ value: count() })
      .from(otpChallenges)
      .where(and(
        eq(otpChallenges.destinationHash, destinationHash),
        eq(otpChallenges.deliveryStatus, "SENT"),
        gte(otpChallenges.createdAt, dayAgo),
      )),
    db
      .select({ value: count() })
      .from(otpChallenges)
      .where(and(
        eq(otpChallenges.requestIpHash, ipHash),
        eq(otpChallenges.deliveryStatus, "SENT"),
        gte(otpChallenges.createdAt, dayAgo),
      )),
  ]);

  if (recent[0]) {
    const elapsed = Math.floor((now.getTime() - recent[0].createdAt.getTime()) / 1000);
    const retryAfter = Math.max(1, OTP_RESEND_SECONDS - elapsed);
    return { ok: true as const, sent: false as const, retryAfter };
  }
  if ((emailCount[0]?.value ?? 0) >= OTP_DAILY_EMAIL_LIMIT) {
    throw new Error("今日验证码发送次数已达上限，请明天再试");
  }
  if ((ipCount[0]?.value ?? 0) >= OTP_DAILY_IP_LIMIT) {
    throw new Error("当前网络请求过于频繁，请稍后再试");
  }

  const challengeId = randomUUID();
  const code = String(randomInt(100000, 1000000));
  await db.insert(otpChallenges).values({
    id: challengeId,
    channel: "EMAIL",
    purpose: "LOGIN",
    destinationHash,
    codeHash: codeHash(challengeId, code),
    requestIpHash: ipHash,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  try {
    const delivery = await sendLoginCode(email, code);
    await db
      .update(otpChallenges)
      .set({ deliveryStatus: "SENT", providerRequestId: delivery.providerRequestId })
      .where(eq(otpChallenges.id, challengeId));
    return { ok: true as const, sent: true as const, retryAfter: OTP_RESEND_SECONDS };
  } catch (error) {
    await db
      .update(otpChallenges)
      .set({ deliveryStatus: "FAILED" })
      .where(eq(otpChallenges.id, challengeId))
      .catch(() => undefined);
    if (error instanceof Error && error.message.includes("尚未配置")) throw error;
    throw new Error("验证码暂时无法发送，请稍后重试");
  }
}

export async function verifyLoginCode(request: NextRequest, rawEmail: string, rawCode: string) {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) throw new AuthenticationError("请输入邮件中的 6 位验证码");

  const db = getDatabase();
  const now = new Date();
  const destinationHash = hmac(`email:${email}`);
  const challenge = await db
    .select()
    .from(otpChallenges)
    .where(and(
      eq(otpChallenges.destinationHash, destinationHash),
      eq(otpChallenges.channel, "EMAIL"),
      eq(otpChallenges.purpose, "LOGIN"),
      eq(otpChallenges.deliveryStatus, "SENT"),
      isNull(otpChallenges.consumedAt),
      gt(otpChallenges.expiresAt, now),
    ))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);

  const current = challenge[0];
  if (!current || current.attemptCount >= current.maxAttempts) {
    throw new AuthenticationError("验证码无效或已过期，请重新获取");
  }
  if (!safeEqual(current.codeHash, codeHash(current.id, code))) {
    await db
      .update(otpChallenges)
      .set({ attemptCount: current.attemptCount + 1 })
      .where(and(eq(otpChallenges.id, current.id), isNull(otpChallenges.consumedAt)));
    throw new AuthenticationError("验证码无效或已过期，请重新获取");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const fingerprint = requestFingerprint(request);
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  const user = await db.transaction(async (transaction) => {
    const consumed = await transaction
      .update(otpChallenges)
      .set({ consumedAt: now, attemptCount: current.attemptCount + 1 })
      .where(and(eq(otpChallenges.id, current.id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    if (!consumed[0]) throw new AuthenticationError("验证码已经使用，请重新获取");

    const existingIdentity = await transaction
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(and(eq(authIdentities.type, "EMAIL"), eq(authIdentities.identifier, email)))
      .limit(1);

    let userId = existingIdentity[0]?.userId;
    if (!userId) {
      const insertedUser = await transaction
        .insert(users)
        .values({ lastLoginAt: now })
        .returning({ id: users.id });
      userId = insertedUser[0].id;
      await transaction.insert(authIdentities).values({
        userId,
        type: "EMAIL",
        identifier: email,
      });
      await transaction.insert(wallets).values({ userId });
    } else {
      await transaction
        .update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, userId));
    }

    const insertedSession = await transaction
      .insert(sessions)
      .values({
        userId,
        tokenHash: tokenHash(rawToken),
        ipHash: fingerprint.ipHash,
        userAgentHash: fingerprint.userAgentHash,
        expiresAt,
      })
      .returning({ id: sessions.id });
    return { id: userId, sessionId: insertedSession[0].id };
  });

  return {
    token: rawToken,
    expiresAt,
    user: { id: user.id, sessionId: user.sessionId, emailMasked: maskEmail(email), locale: "zh-CN" },
  };
}

export function attachAuthSession(response: NextResponse, token: string) {
  response.cookies.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export function clearAuthSession(response: NextResponse) {
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export async function authenticateSessionToken(token: string | undefined): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const db = getDatabase();
  const now = new Date();
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      locale: users.locale,
      status: users.status,
      email: authIdentities.identifier,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(
      authIdentities,
      and(eq(authIdentities.userId, users.id), eq(authIdentities.type, "EMAIL")),
    )
    .where(and(
      eq(sessions.tokenHash, tokenHash(token)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "ACTIVE") return null;
  if (now.getTime() - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, row.sessionId))
      .catch(() => undefined);
  }
  return {
    id: row.userId,
    email: row.email,
    sessionId: row.sessionId,
    emailMasked: maskEmail(row.email),
    locale: row.locale,
  };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  return authenticateSessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) throw new AuthenticationError();
  return user;
}

export async function revokeRequestSession(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return;
  const db = getDatabase();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash(token)), isNull(sessions.revokedAt)));
}
