import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { getDatabase } from "../src/db/client";
import {
  authIdentities,
  paymentEvents,
  paymentOrders,
  sessions,
  users,
  walletLedger,
  wallets,
} from "../src/db/schema";
import { AdminAuthorizationError, requireAdminApiAccess } from "../src/lib/admin-auth";
import {
  createPaymentOrder,
  getOrderById,
  getReusablePaymentOrder,
  markOrderPaid,
  prepareRefund,
  releaseGeneration,
  reserveGeneration,
  updateRefundStatus,
  updateOrderStatus,
} from "../src/lib/payment-store";

const databaseUrl = process.env.DATABASE_URL?.trim();

test("PostgreSQL payment, generation, refund and admin invariants", { skip: !databaseUrl }, async () => {
  process.env.ADMIN_EMAILS = "admin@example.com";
  const db = getDatabase();

  const userRows = await db.insert(users).values({}).returning({ id: users.id });
  const userId = userRows[0].id;
  await db.insert(wallets).values({ userId });

  const order = await createPaymentOrder({
    userId,
    packageId: "test-3",
    subject: "Integration test credits",
    amountFen: 150,
    credits: 3,
  });
  assert.equal(
    (await getReusablePaymentOrder(userId, "test-3"))?.id,
    order.id,
    "recent unpaid orders can be reused before checkout",
  );
  await Promise.all([
    markOrderPaid({
      orderId: order.id,
      tradeNo: "trade-test-1",
      notifyId: "notify-test-1",
      tradeStatus: "TRADE_SUCCESS",
      payloadHash: "hash-1",
    }),
    markOrderPaid({
      orderId: order.id,
      tradeNo: "trade-test-1",
      notifyId: "notify-test-1",
      tradeStatus: "TRADE_SUCCESS",
      payloadHash: "hash-1",
    }),
  ]);

  let wallet = await db.select().from(wallets).where(eq(wallets.userId, userId));
  assert.equal(wallet[0].balanceCredits, 3, "duplicate notifications credit exactly once");
  const creditLedger = await db
    .select()
    .from(walletLedger)
    .where(eq(walletLedger.idempotencyKey, `payment:${order.id}:credit`));
  assert.equal(creditLedger.length, 1);
  const notifyRows = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.providerEventId, "notify-test-1"));
  assert.equal(notifyRows.length, 1);
  await updateOrderStatus(order.id, "PENDING_PAYMENT");
  assert.equal((await getOrderById(order.id))?.status, "PAID", "stale polling cannot regress a paid order");
  assert.equal(await getReusablePaymentOrder(userId, "test-3"), undefined, "paid orders are never reused");

  const expiry = new Date(Date.now() + 60_000);
  const reservations = await Promise.all([
    reserveGeneration({
      userId,
      templateId: "test-template",
      credits: 2,
      provider: "boxai",
      model: "test-model",
      requestedCount: 2,
      expiresAt: expiry,
    }),
    reserveGeneration({
      userId,
      templateId: "test-template",
      credits: 2,
      provider: "boxai",
      model: "test-model",
      requestedCount: 2,
      expiresAt: expiry,
    }),
  ]);
  const successfulReservation = reservations.find((item) => item.ok);
  assert.equal(reservations.filter((item) => item.ok).length, 1, "guarded wallet update prevents overspending");
  assert.ok(successfulReservation?.ok);
  wallet = await db.select().from(wallets).where(eq(wallets.userId, userId));
  assert.equal(wallet[0].balanceCredits, 1);

  await Promise.all([
    releaseGeneration(successfulReservation.reservationId),
    releaseGeneration(successfulReservation.reservationId),
  ]);
  wallet = await db.select().from(wallets).where(eq(wallets.userId, userId));
  assert.equal(wallet[0].balanceCredits, 3, "generation release is idempotent");

  const failedRefund = await prepareRefund({
    orderId: order.id,
    idempotencyKey: "refund-failed-test",
    amountFen: 50,
    reason: "integration test",
    unitPriceFen: 50,
  });
  const sameRefund = await prepareRefund({
    orderId: order.id,
    idempotencyKey: "refund-failed-test",
    amountFen: 50,
    reason: "integration test",
    unitPriceFen: 50,
  });
  assert.equal(sameRefund.id, failedRefund.id, "refund preparation is idempotent");
  await Promise.all([
    updateRefundStatus(failedRefund.id, "FAILED"),
    updateRefundStatus(failedRefund.id, "FAILED"),
  ]);
  wallet = await db.select().from(wallets).where(eq(wallets.userId, userId));
  assert.equal(wallet[0].balanceCredits, 3, "failed refund releases credits exactly once");

  const succeededRefund = await prepareRefund({
    orderId: order.id,
    idempotencyKey: "refund-success-test",
    amountFen: 50,
    reason: "integration test",
    unitPriceFen: 50,
  });
  await updateRefundStatus(succeededRefund.id, "SUCCEEDED");
  const updatedOrder = await getOrderById(order.id);
  assert.equal(updatedOrder?.refundedFen, 50);
  assert.equal(updatedOrder?.status, "PARTIALLY_REFUNDED");

  const adminToken = randomBytes(32).toString("base64url");
  const memberToken = randomBytes(32).toString("base64url");
  const adminRows = await db.insert(users).values({}).returning({ id: users.id });
  const memberRows = await db.insert(users).values({}).returning({ id: users.id });
  const adminId = adminRows[0].id;
  const memberId = memberRows[0].id;
  await db.insert(authIdentities).values([
    { userId: adminId, type: "EMAIL", identifier: "admin@example.com" },
    { userId: memberId, type: "EMAIL", identifier: "member@example.com" },
  ]);
  const expiresAt = new Date(Date.now() + 60_000);
  await db.insert(sessions).values([
    {
      userId: adminId,
      tokenHash: createHash("sha256").update(adminToken).digest("hex"),
      ipHash: "test",
      userAgentHash: "test",
      expiresAt,
    },
    {
      userId: memberId,
      tokenHash: createHash("sha256").update(memberToken).digest("hex"),
      ipHash: "test",
      userAgentHash: "test",
      expiresAt,
    },
  ]);

  const requestFor = (token?: string) => new NextRequest("http://localhost/api/admin/templates", {
    headers: token ? { cookie: `zaojing_auth_session=${token}` } : undefined,
  });
  await assert.rejects(
    () => requireAdminApiAccess(requestFor()),
    (error) => error instanceof AdminAuthorizationError && error.status === 401,
  );
  await assert.rejects(
    () => requireAdminApiAccess(requestFor(memberToken)),
    (error) => error instanceof AdminAuthorizationError && error.status === 403,
  );
  const access = await requireAdminApiAccess(requestFor(adminToken));
  assert.equal(access.type, "session");

  const storedOrder = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id));
  assert.equal(storedOrder.length, 1);
});
