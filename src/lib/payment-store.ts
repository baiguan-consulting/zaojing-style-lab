import "server-only";

import { randomBytes } from "node:crypto";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  generationReservations,
  generationTasks,
  paymentEvents,
  paymentOrders,
  refunds,
  walletLedger,
  wallets,
} from "@/db/schema";

export type PaymentOrderStatus =
  | "CREATED"
  | "PENDING_PAYMENT"
  | "PAID"
  | "CLOSED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "FAILED";

export type PaymentOrder = {
  id: string;
  userId: string;
  outTradeNo: string;
  packageId: string;
  subject: string;
  amountFen: number;
  credits: number;
  status: PaymentOrderStatus;
  alipayTradeNo?: string;
  refundedFen: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
};

export type RefundRecord = {
  id: string;
  orderId: string;
  outRequestNo: string;
  idempotencyKey: string;
  amountFen: number;
  creditsReserved: number;
  reason: string;
  status: "PREPARED" | "UNKNOWN" | "SUCCEEDED" | "FAILED";
  createdAt: string;
  updatedAt: string;
};

type PaymentOrderRow = typeof paymentOrders.$inferSelect;
type RefundRow = typeof refunds.$inferSelect;

function mapOrder(row: PaymentOrderRow): PaymentOrder {
  return {
    id: row.id,
    userId: row.userId,
    outTradeNo: row.outTradeNo,
    packageId: row.packageId,
    subject: row.subject,
    amountFen: row.amountFen,
    credits: row.credits,
    status: row.status as PaymentOrderStatus,
    alipayTradeNo: row.providerTradeNo ?? undefined,
    refundedFen: row.refundedFen,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    paidAt: row.paidAt?.toISOString(),
  };
}

function mapRefund(row: RefundRow): RefundRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    outRequestNo: row.outRequestNo,
    idempotencyKey: row.idempotencyKey,
    amountFen: row.amountFen,
    creditsReserved: row.creditsReserved,
    reason: row.reason,
    status: row.status as RefundRecord["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeOutTradeNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `ZJ${date}${randomBytes(10).toString("hex").toUpperCase()}`;
}

function makeOutRequestNo() {
  return `RF${Date.now()}${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function getAccount(userId: string) {
  const db = getDatabase();
  await db.insert(wallets).values({ userId }).onConflictDoNothing();
  const [walletRows, orderRows] = await Promise.all([
    db.select({ balanceCredits: wallets.balanceCredits }).from(wallets).where(eq(wallets.userId, userId)).limit(1),
    db.select().from(paymentOrders).where(eq(paymentOrders.userId, userId)).orderBy(desc(paymentOrders.createdAt)).limit(10),
  ]);
  return {
    userId,
    balanceCredits: walletRows[0]?.balanceCredits ?? 0,
    orders: orderRows.map(mapOrder),
  };
}

export async function mergePaymentUser(_sourceUserId: string | undefined, targetUserId: string) {
  // Legacy anonymous balances lived in the prototype JSON store and are not imported
  // into the production ledger. Authenticated PostgreSQL users always get a wallet.
  await getDatabase().insert(wallets).values({ userId: targetUserId }).onConflictDoNothing();
}

export async function createPaymentOrder(input: {
  userId: string;
  packageId: string;
  subject: string;
  amountFen: number;
  credits: number;
}) {
  if (!Number.isInteger(input.amountFen) || input.amountFen < 1) throw new Error("支付金额不合法");
  if (!Number.isInteger(input.credits) || input.credits < 1) throw new Error("创作次数不合法");
  const inserted = await getDatabase()
    .insert(paymentOrders)
    .values({
      userId: input.userId,
      outTradeNo: makeOutTradeNo(),
      packageId: input.packageId,
      subject: input.subject,
      amountFen: input.amountFen,
      credits: input.credits,
    })
    .returning();
  return mapOrder(inserted[0]);
}

export async function getReusablePaymentOrder(userId: string, packageId: string) {
  const reusableAfter = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await getDatabase()
    .select()
    .from(paymentOrders)
    .where(and(
      eq(paymentOrders.userId, userId),
      eq(paymentOrders.packageId, packageId),
      inArray(paymentOrders.status, ["CREATED", "PENDING_PAYMENT"]),
      gte(paymentOrders.createdAt, reusableAfter),
    ))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(1);
  return rows[0] ? mapOrder(rows[0]) : undefined;
}

export async function updateOrderStatus(orderId: string, status: PaymentOrderStatus) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${paymentOrders.id} from ${paymentOrders} where ${paymentOrders.id} = ${orderId} for update`);
    const rows = await transaction.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
    const current = rows[0];
    if (!current) throw new Error("支付订单不存在");

    const immutableStatuses = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
    const wouldReopenClosed = current.status === "CLOSED" && status !== "CLOSED";
    if (immutableStatuses.includes(current.status) || wouldReopenClosed) return mapOrder(current);

    const updated = await transaction
      .update(paymentOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentOrders.id, orderId))
      .returning();
    return mapOrder(updated[0]);
  });
}

export async function getOrderByOutTradeNo(outTradeNo: string) {
  const rows = await getDatabase()
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.outTradeNo, outTradeNo))
    .limit(1);
  return rows[0] ? mapOrder(rows[0]) : undefined;
}

export async function getOrderForUser(orderId: string, userId: string) {
  const rows = await getDatabase()
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, userId)))
    .limit(1);
  return rows[0] ? mapOrder(rows[0]) : undefined;
}

export async function getOrderById(orderId: string) {
  const rows = await getDatabase().select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
  return rows[0] ? mapOrder(rows[0]) : undefined;
}

export async function markOrderPaid(input: {
  orderId: string;
  tradeNo: string;
  notifyId?: string;
  tradeStatus: string;
  payloadHash?: string;
}) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${paymentOrders.id} from ${paymentOrders} where ${paymentOrders.id} = ${input.orderId} for update`);
    const rows = await transaction.select().from(paymentOrders).where(eq(paymentOrders.id, input.orderId)).limit(1);
    const current = rows[0];
    if (!current) throw new Error("支付订单不存在");

    if (input.notifyId) {
      const event = await transaction
        .insert(paymentEvents)
        .values({
          orderId: current.id,
          provider: "ALIPAY",
          providerEventId: input.notifyId,
          providerTradeNo: input.tradeNo,
          eventType: input.tradeStatus,
          payloadHash: input.payloadHash ?? "",
        })
        .onConflictDoNothing()
        .returning({ id: paymentEvents.id });
      if (!event[0]) return { order: mapOrder(current), duplicate: true };
    }

    const alreadyCredited = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current.status);
    let updatedOrder = current;
    if (!alreadyCredited) {
      await transaction.insert(wallets).values({ userId: current.userId }).onConflictDoNothing();
      const walletRows = await transaction
        .update(wallets)
        .set({
          balanceCredits: sql`${wallets.balanceCredits} + ${current.credits}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, current.userId))
        .returning({ balanceCredits: wallets.balanceCredits });
      const balanceAfter = walletRows[0]?.balanceCredits;
      if (balanceAfter === undefined) throw new Error("钱包不存在");

      await transaction.insert(walletLedger).values({
        userId: current.userId,
        type: "PAYMENT_CREDIT",
        deltaCredits: current.credits,
        balanceAfter,
        idempotencyKey: `payment:${current.id}:credit`,
        referenceType: "PAYMENT_ORDER",
        referenceId: current.id,
      });
      const paidRows = await transaction
        .update(paymentOrders)
        .set({
          status: "PAID",
          providerTradeNo: input.tradeNo || current.providerTradeNo,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, current.id))
        .returning();
      updatedOrder = paidRows[0];
    } else if (input.tradeNo && !current.providerTradeNo) {
      const tradeRows = await transaction
        .update(paymentOrders)
        .set({ providerTradeNo: input.tradeNo, updatedAt: new Date() })
        .where(eq(paymentOrders.id, current.id))
        .returning();
      updatedOrder = tradeRows[0];
    }
    return { order: mapOrder(updatedOrder), duplicate: false };
  });
}

export async function recordPaymentEvent(input: {
  notifyId: string;
  outTradeNo: string;
  tradeNo: string;
  tradeStatus: string;
  payloadHash: string;
}) {
  const db = getDatabase();
  const orderRows = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .where(eq(paymentOrders.outTradeNo, input.outTradeNo))
    .limit(1);
  const inserted = await db
    .insert(paymentEvents)
    .values({
      orderId: orderRows[0]?.id,
      provider: "ALIPAY",
      providerEventId: input.notifyId,
      providerTradeNo: input.tradeNo,
      eventType: input.tradeStatus,
      payloadHash: input.payloadHash,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  return { duplicate: !inserted[0] };
}

export async function reserveGeneration(input: {
  userId: string;
  templateId: string;
  credits: number;
  provider: string;
  model: string;
  requestedCount: number;
  expiresAt: Date;
  templateOwnerUserId?: string;
  creatorRewardFen?: number;
}) {
  if (!Number.isInteger(input.credits) || input.credits < 1) throw new Error("创作次数不合法");
  return getDatabase().transaction(async (transaction) => {
    await transaction.insert(wallets).values({ userId: input.userId }).onConflictDoNothing();
    const walletRows = await transaction
      .update(wallets)
      .set({
        balanceCredits: sql`${wallets.balanceCredits} - ${input.credits}`,
        updatedAt: new Date(),
      })
      .where(and(eq(wallets.userId, input.userId), sql`${wallets.balanceCredits} >= ${input.credits}`))
      .returning({ balanceCredits: wallets.balanceCredits });
    if (!walletRows[0]) {
      const current = await transaction
        .select({ balanceCredits: wallets.balanceCredits })
        .from(wallets)
        .where(eq(wallets.userId, input.userId))
        .limit(1);
      return { ok: false as const, balanceCredits: current[0]?.balanceCredits ?? 0 };
    }

    const taskRows = await transaction
      .insert(generationTasks)
      .values({
        userId: input.userId,
        templateId: input.templateId,
        provider: input.provider,
        model: input.model,
        requestedCount: input.requestedCount,
        fundingSource: "LEGACY",
        templateOwnerUserId: input.templateOwnerUserId,
        creatorRewardFen: input.creatorRewardFen ?? 0,
        status: "RUNNING",
        expiresAt: input.expiresAt,
      })
      .returning({ id: generationTasks.id });
    const reservationRows = await transaction
      .insert(generationReservations)
      .values({
        userId: input.userId,
        taskId: taskRows[0].id,
        templateId: input.templateId,
        reservedCredits: input.credits,
      })
      .returning({ id: generationReservations.id });
    const reservationId = reservationRows[0].id;
    await transaction.insert(walletLedger).values({
      userId: input.userId,
      type: "GENERATION_RESERVE",
      deltaCredits: -input.credits,
      balanceAfter: walletRows[0].balanceCredits,
      idempotencyKey: `generation:${reservationId}:reserve`,
      referenceType: "GENERATION_RESERVATION",
      referenceId: reservationId,
      metadata: { taskId: taskRows[0].id, templateId: input.templateId },
    });
    return {
      ok: true as const,
      reservationId,
      taskId: taskRows[0].id,
      balanceCredits: walletRows[0].balanceCredits,
    };
  });
}

export async function settleGeneration(
  reservationId: string,
  successfulCredits: number,
  successfulCount: number,
) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${generationReservations.id} from ${generationReservations} where ${generationReservations.id} = ${reservationId} for update`);
    const rows = await transaction
      .select()
      .from(generationReservations)
      .where(eq(generationReservations.id, reservationId))
      .limit(1);
    const reservation = rows[0];
    if (!reservation) throw new Error("创作次数预留记录不存在");
    if (reservation.status !== "RESERVED") return reservation;

    const settled = Math.max(0, Math.min(reservation.reservedCredits, Math.trunc(successfulCredits)));
    const releaseCredits = reservation.reservedCredits - settled;
    if (releaseCredits > 0) {
      const walletRows = await transaction
        .update(wallets)
        .set({
          balanceCredits: sql`${wallets.balanceCredits} + ${releaseCredits}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, reservation.userId))
        .returning({ balanceCredits: wallets.balanceCredits });
      if (!walletRows[0]) throw new Error("钱包不存在");
      await transaction.insert(walletLedger).values({
        userId: reservation.userId,
        type: "GENERATION_RELEASE",
        deltaCredits: releaseCredits,
        balanceAfter: walletRows[0].balanceCredits,
        idempotencyKey: `generation:${reservation.id}:release`,
        referenceType: "GENERATION_RESERVATION",
        referenceId: reservation.id,
      });
    }

    const status = settled > 0 ? "SETTLED" : "RELEASED";
    const updated = await transaction
      .update(generationReservations)
      .set({ settledCredits: settled, status, updatedAt: new Date() })
      .where(eq(generationReservations.id, reservation.id))
      .returning();
    if (reservation.taskId) {
      await transaction
        .update(generationTasks)
        .set({
          successfulCount: Math.max(0, Math.trunc(successfulCount)),
          status: settled > 0 ? "COMPLETED" : "FAILED",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationTasks.id, reservation.taskId));
    }
    return updated[0];
  });
}

export async function releaseGeneration(reservationId: string) {
  return settleGeneration(reservationId, 0, 0);
}

export async function prepareRefund(input: {
  orderId: string;
  idempotencyKey: string;
  amountFen: number;
  reason: string;
  unitPriceFen: number;
}) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${paymentOrders.id} from ${paymentOrders} where ${paymentOrders.id} = ${input.orderId} for update`);
    const existingRows = await transaction
      .select()
      .from(refunds)
      .where(and(eq(refunds.orderId, input.orderId), eq(refunds.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existingRows[0]) return mapRefund(existingRows[0]);

    const orderRows = await transaction.select().from(paymentOrders).where(eq(paymentOrders.id, input.orderId)).limit(1);
    const order = orderRows[0];
    if (!order || !["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) {
      throw new Error("订单未支付或当前不可退款");
    }
    if (!Number.isInteger(input.amountFen) || input.amountFen < 1) throw new Error("退款金额不合法");
    if (!Number.isInteger(input.unitPriceFen) || input.unitPriceFen < 1 || input.amountFen % input.unitPriceFen !== 0) {
      throw new Error("退款金额必须对应完整的创作次数");
    }
    const activeRefundRows = await transaction
      .select({ amountFen: refunds.amountFen })
      .from(refunds)
      .where(and(eq(refunds.orderId, order.id), inArray(refunds.status, ["PREPARED", "UNKNOWN", "SUCCEEDED"])));
    const alreadyRequestedFen = activeRefundRows.reduce((sum, item) => sum + item.amountFen, 0);
    if (input.amountFen + alreadyRequestedFen > order.amountFen) {
      throw new Error("退款金额超过订单可退金额");
    }

    const creditsReserved = input.amountFen / input.unitPriceFen;
    const walletRows = await transaction
      .update(wallets)
      .set({
        balanceCredits: sql`${wallets.balanceCredits} - ${creditsReserved}`,
        updatedAt: new Date(),
      })
      .where(and(eq(wallets.userId, order.userId), sql`${wallets.balanceCredits} >= ${creditsReserved}`))
      .returning({ balanceCredits: wallets.balanceCredits });
    if (!walletRows[0]) throw new Error("用户剩余创作次数不足，不能直接退款");

    const refundRows = await transaction
      .insert(refunds)
      .values({
        orderId: order.id,
        outRequestNo: makeOutRequestNo(),
        idempotencyKey: input.idempotencyKey,
        amountFen: input.amountFen,
        creditsReserved,
        reason: input.reason,
      })
      .returning();
    const refund = refundRows[0];
    await transaction.insert(walletLedger).values({
      userId: order.userId,
      type: "REFUND_RESERVE",
      deltaCredits: -creditsReserved,
      balanceAfter: walletRows[0].balanceCredits,
      idempotencyKey: `refund:${refund.id}:reserve`,
      referenceType: "REFUND",
      referenceId: refund.id,
      metadata: { orderId: order.id },
    });
    return mapRefund(refund);
  });
}

export async function updateRefundStatus(refundId: string, status: RefundRecord["status"]) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${refunds.id} from ${refunds} where ${refunds.id} = ${refundId} for update`);
    const refundRows = await transaction.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
    const refund = refundRows[0];
    if (!refund) throw new Error("退款记录不存在");
    if (refund.status === "SUCCEEDED" || refund.status === "FAILED") return mapRefund(refund);

    await transaction.execute(sql`select ${paymentOrders.id} from ${paymentOrders} where ${paymentOrders.id} = ${refund.orderId} for update`);
    const orderRows = await transaction.select().from(paymentOrders).where(eq(paymentOrders.id, refund.orderId)).limit(1);
    const order = orderRows[0];
    if (!order) throw new Error("退款关联订单不存在");

    if (status === "FAILED") {
      const walletRows = await transaction
        .update(wallets)
        .set({
          balanceCredits: sql`${wallets.balanceCredits} + ${refund.creditsReserved}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, order.userId))
        .returning({ balanceCredits: wallets.balanceCredits });
      if (!walletRows[0]) throw new Error("钱包不存在");
      await transaction.insert(walletLedger).values({
        userId: order.userId,
        type: "REFUND_RELEASE",
        deltaCredits: refund.creditsReserved,
        balanceAfter: walletRows[0].balanceCredits,
        idempotencyKey: `refund:${refund.id}:release`,
        referenceType: "REFUND",
        referenceId: refund.id,
        metadata: { orderId: order.id },
      });
    }
    if (status === "SUCCEEDED") {
      const refundedFen = order.refundedFen + refund.amountFen;
      await transaction
        .update(paymentOrders)
        .set({
          refundedFen,
          status: refundedFen >= order.amountFen ? "REFUNDED" : "PARTIALLY_REFUNDED",
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
    }

    const updatedRows = await transaction
      .update(refunds)
      .set({
        status,
        completedAt: status === "SUCCEEDED" || status === "FAILED" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refund.id))
      .returning();
    return mapRefund(updatedRows[0]);
  });
}

export async function getRefundById(refundId: string) {
  const rows = await getDatabase().select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
  return rows[0] ? mapRefund(rows[0]) : undefined;
}
