import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, gt, lte, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  authIdentities,
  creatorEarningLedger,
  creatorProfiles,
  creatorWithdrawals,
  generationTasks,
  rewardCreditLedger,
  rewardCreditWallets,
} from "@/db/schema";

export const CREATOR_REWARD_FEN = 20;
export const EARNING_TO_CREDIT_FEN = 50;
export const CREATOR_HOLD_DAYS = 7;
export const MIN_WITHDRAWAL_FEN = 5_000;

type CreatorProfileRow = typeof creatorProfiles.$inferSelect;
type CreatorWithdrawalRow = typeof creatorWithdrawals.$inferSelect;

function payoutKey() {
  const secret = process.env.CREATOR_PAYOUT_ENCRYPTION_KEY?.trim()
    || process.env.APP_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("创作者收款信息加密密钥尚未配置");
  }
  return createHash("sha256").update(secret).digest();
}

function encryptPayoutValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payoutKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString("base64url")).join(".");
}

function decryptPayoutValue(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("收款信息格式无效");
  const decipher = createDecipheriv("aes-256-gcm", payoutKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function maskName(value: string) {
  if (value.length <= 1) return "*";
  return `${value.slice(0, 1)}${"*".repeat(Math.min(3, value.length - 1))}`;
}

function maskAccount(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (value.length <= 7) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function mapProfile(row: CreatorProfileRow | undefined) {
  if (!row) return undefined;
  return {
    userId: row.userId,
    displayName: row.displayName,
    bio: row.bio,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapWithdrawal(row: CreatorWithdrawalRow, includePrivate = false) {
  return {
    id: row.id,
    userId: row.userId,
    amountFen: row.amountFen,
    status: row.status,
    payeeName: includePrivate ? decryptPayoutValue(row.payeeNameEncrypted) : row.payeeNameMasked,
    alipayAccount: includePrivate ? decryptPayoutValue(row.alipayAccountEncrypted) : row.alipayAccountMasked,
    contactEmail: row.contactEmail,
    reviewNote: row.reviewNote ?? undefined,
    transferReference: row.transferReference ?? undefined,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString(),
    paidAt: row.paidAt?.toISOString(),
  };
}

export async function getCreatorProfile(userId: string) {
  const rows = await getDatabase()
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId))
    .limit(1);
  return mapProfile(rows[0]);
}

export async function saveCreatorProfile(input: {
  userId: string;
  displayName: string;
  bio?: string;
}) {
  const displayName = input.displayName.trim().slice(0, 30);
  const bio = (input.bio ?? "").trim().slice(0, 240);
  if (displayName.length < 2) throw new Error("创作者昵称至少需要 2 个字符");
  const rows = await getDatabase()
    .insert(creatorProfiles)
    .values({ userId: input.userId, displayName, bio })
    .onConflictDoUpdate({
      target: creatorProfiles.userId,
      set: { displayName, bio, updatedAt: new Date() },
    })
    .returning();
  return mapProfile(rows[0]);
}

async function earningBalances(userId: string) {
  const now = new Date();
  const [availableRows, pendingRows, earnedRows] = await Promise.all([
    getDatabase()
      .select({ value: sql<number>`coalesce(sum(${creatorEarningLedger.deltaFen}), 0)` })
      .from(creatorEarningLedger)
      .where(and(
        eq(creatorEarningLedger.creatorUserId, userId),
        lte(creatorEarningLedger.availableAt, now),
      )),
    getDatabase()
      .select({ value: sql<number>`coalesce(sum(${creatorEarningLedger.deltaFen}), 0)` })
      .from(creatorEarningLedger)
      .where(and(
        eq(creatorEarningLedger.creatorUserId, userId),
        eq(creatorEarningLedger.type, "GENERATION_REWARD"),
        gt(creatorEarningLedger.availableAt, now),
      )),
    getDatabase()
      .select({ value: sql<number>`coalesce(sum(${creatorEarningLedger.deltaFen}), 0)` })
      .from(creatorEarningLedger)
      .where(and(
        eq(creatorEarningLedger.creatorUserId, userId),
        eq(creatorEarningLedger.type, "GENERATION_REWARD"),
      )),
  ]);
  return {
    availableFen: Math.max(0, Number(availableRows[0]?.value ?? 0)),
    pendingFen: Math.max(0, Number(pendingRows[0]?.value ?? 0)),
    totalEarnedFen: Math.max(0, Number(earnedRows[0]?.value ?? 0)),
  };
}

export async function getRewardCreditBalance(userId: string) {
  await getDatabase().insert(rewardCreditWallets).values({ userId }).onConflictDoNothing();
  const rows = await getDatabase()
    .select({ balanceCredits: rewardCreditWallets.balanceCredits })
    .from(rewardCreditWallets)
    .where(eq(rewardCreditWallets.userId, userId))
    .limit(1);
  return rows[0]?.balanceCredits ?? 0;
}

export async function getCreatorDashboard(userId: string) {
  const db = getDatabase();
  const [profile, balances, rewardCredits, ledgerRows, withdrawalRows, withdrawalTotals] = await Promise.all([
    getCreatorProfile(userId),
    earningBalances(userId),
    getRewardCreditBalance(userId),
    db.select().from(creatorEarningLedger)
      .where(eq(creatorEarningLedger.creatorUserId, userId))
      .orderBy(desc(creatorEarningLedger.createdAt)).limit(20),
    db.select().from(creatorWithdrawals)
      .where(eq(creatorWithdrawals.userId, userId))
      .orderBy(desc(creatorWithdrawals.createdAt)).limit(20),
    db.select({
      processingFen: sql<number>`coalesce(sum(case when ${creatorWithdrawals.status} in ('PENDING', 'APPROVED') then ${creatorWithdrawals.amountFen} else 0 end), 0)`,
      paidFen: sql<number>`coalesce(sum(case when ${creatorWithdrawals.status} = 'PAID' then ${creatorWithdrawals.amountFen} else 0 end), 0)`,
    }).from(creatorWithdrawals).where(eq(creatorWithdrawals.userId, userId)),
  ]);
  return {
    profile,
    balances: {
      ...balances,
      rewardCredits,
      processingFen: Number(withdrawalTotals[0]?.processingFen ?? 0),
      paidFen: Number(withdrawalTotals[0]?.paidFen ?? 0),
    },
    ledger: ledgerRows.map((item) => ({
      id: item.id,
      type: item.type,
      deltaFen: item.deltaFen,
      templateId: item.templateId ?? undefined,
      availableAt: item.availableAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
    withdrawals: withdrawalRows.map((item) => mapWithdrawal(item)),
  };
}

export async function awardCreatorForCompletedTask(taskId: string) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${generationTasks.id} from ${generationTasks} where ${generationTasks.id} = ${taskId} for update`);
    const taskRows = await transaction.select().from(generationTasks)
      .where(eq(generationTasks.id, taskId)).limit(1);
    const task = taskRows[0];
    if (!task || task.status !== "COMPLETED" || !task.templateOwnerUserId) return undefined;
    if (task.templateOwnerUserId === task.userId || task.creatorRewardFen < 1 || task.successfulCount < 1) return undefined;
    if (!["NOWPAY", "REWARD_CREDITS"].includes(task.fundingSource)) return undefined;

    const profileRows = await transaction.select({ status: creatorProfiles.status })
      .from(creatorProfiles).where(eq(creatorProfiles.userId, task.templateOwnerUserId)).limit(1);
    if (profileRows[0]?.status !== "ACTIVE") return undefined;

    const amountFen = task.successfulCount * task.creatorRewardFen;
    const availableAt = new Date((task.completedAt ?? new Date()).getTime() + CREATOR_HOLD_DAYS * 24 * 60 * 60 * 1000);
    const inserted = await transaction.insert(creatorEarningLedger).values({
      creatorUserId: task.templateOwnerUserId,
      generationTaskId: task.id,
      templateId: task.templateId,
      type: "GENERATION_REWARD",
      deltaFen: amountFen,
      availableAt,
      idempotencyKey: `creator-reward:${task.id}`,
      metadata: {
        successfulCount: task.successfulCount,
        rewardFenPerImage: task.creatorRewardFen,
        fundingSource: task.fundingSource,
      },
    }).onConflictDoNothing().returning();
    return inserted[0];
  });
}

export async function tryReserveRewardGeneration(input: {
  userId: string;
  templateId: string;
  provider: string;
  model: string;
  requestedCount: number;
  requiredCredits: number;
  expiresAt: Date;
  templateOwnerUserId?: string;
  creatorRewardFen: number;
}) {
  if (!Number.isInteger(input.requiredCredits) || input.requiredCredits < 1) {
    throw new Error("创作次数不合法");
  }
  return getDatabase().transaction(async (transaction) => {
    await transaction.insert(rewardCreditWallets).values({ userId: input.userId }).onConflictDoNothing();
    const walletRows = await transaction.update(rewardCreditWallets).set({
      balanceCredits: sql`${rewardCreditWallets.balanceCredits} - ${input.requiredCredits}`,
      updatedAt: new Date(),
    }).where(and(
      eq(rewardCreditWallets.userId, input.userId),
      sql`${rewardCreditWallets.balanceCredits} >= ${input.requiredCredits}`,
    )).returning({ balanceCredits: rewardCreditWallets.balanceCredits });
    if (!walletRows[0]) return { ok: false as const };

    const taskRows = await transaction.insert(generationTasks).values({
      userId: input.userId,
      templateId: input.templateId,
      provider: input.provider,
      model: input.model,
      requestedCount: input.requestedCount,
      fundingSource: "REWARD_CREDITS",
      templateOwnerUserId: input.templateOwnerUserId,
      creatorRewardFen: input.creatorRewardFen,
      rewardCreditsUsed: input.requiredCredits,
      status: "RUNNING",
      expiresAt: input.expiresAt,
    }).returning();
    const task = taskRows[0];
    await transaction.insert(rewardCreditLedger).values({
      userId: input.userId,
      type: "GENERATION_RESERVE",
      deltaCredits: -input.requiredCredits,
      balanceAfter: walletRows[0].balanceCredits,
      idempotencyKey: `reward-generation:${task.id}:reserve`,
      referenceType: "GENERATION_TASK",
      referenceId: task.id,
      metadata: { templateId: input.templateId },
    });
    return { ok: true as const, task, balanceCredits: walletRows[0].balanceCredits };
  });
}

export async function settleRewardGeneration(taskId: string, resultUrls: string[]) {
  await getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${generationTasks.id} from ${generationTasks} where ${generationTasks.id} = ${taskId} for update`);
    const rows = await transaction.select().from(generationTasks).where(eq(generationTasks.id, taskId)).limit(1);
    const task = rows[0];
    if (!task || task.fundingSource !== "REWARD_CREDITS") throw new Error("平台奖励次数任务不存在");
    if (task.status === "COMPLETED") return;
    if (task.status !== "RUNNING") throw new Error("创作任务当前不可结算");
    const now = new Date();
    await transaction.update(generationTasks).set({
      resultUrls,
      successfulCount: resultUrls.length,
      status: "COMPLETED",
      completedAt: now,
      updatedAt: now,
    }).where(eq(generationTasks.id, task.id));
    if (
      task.templateOwnerUserId
      && task.templateOwnerUserId !== task.userId
      && task.creatorRewardFen > 0
      && resultUrls.length > 0
    ) {
      const profiles = await transaction.select({ status: creatorProfiles.status })
        .from(creatorProfiles).where(eq(creatorProfiles.userId, task.templateOwnerUserId)).limit(1);
      if (profiles[0]?.status === "ACTIVE") {
        await transaction.insert(creatorEarningLedger).values({
          creatorUserId: task.templateOwnerUserId,
          generationTaskId: task.id,
          templateId: task.templateId,
          type: "GENERATION_REWARD",
          deltaFen: resultUrls.length * task.creatorRewardFen,
          availableAt: new Date(now.getTime() + CREATOR_HOLD_DAYS * 24 * 60 * 60 * 1000),
          idempotencyKey: `creator-reward:${task.id}`,
          metadata: {
            successfulCount: resultUrls.length,
            rewardFenPerImage: task.creatorRewardFen,
            fundingSource: task.fundingSource,
          },
        }).onConflictDoNothing();
      }
    }
  });
}

export async function releaseRewardGeneration(taskId: string, errorMessage: string) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${generationTasks.id} from ${generationTasks} where ${generationTasks.id} = ${taskId} for update`);
    const rows = await transaction.select().from(generationTasks).where(eq(generationTasks.id, taskId)).limit(1);
    const task = rows[0];
    if (!task || task.fundingSource !== "REWARD_CREDITS" || task.status !== "RUNNING") return task;
    const walletRows = await transaction.update(rewardCreditWallets).set({
      balanceCredits: sql`${rewardCreditWallets.balanceCredits} + ${task.rewardCreditsUsed}`,
      updatedAt: new Date(),
    }).where(eq(rewardCreditWallets.userId, task.userId)).returning({ balanceCredits: rewardCreditWallets.balanceCredits });
    if (!walletRows[0]) throw new Error("平台奖励次数账户不存在");
    await transaction.insert(rewardCreditLedger).values({
      userId: task.userId,
      type: "GENERATION_RELEASE",
      deltaCredits: task.rewardCreditsUsed,
      balanceAfter: walletRows[0].balanceCredits,
      idempotencyKey: `reward-generation:${task.id}:release`,
      referenceType: "GENERATION_TASK",
      referenceId: task.id,
    }).onConflictDoNothing();
    const now = new Date();
    const updated = await transaction.update(generationTasks).set({
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 500),
      completedAt: now,
      updatedAt: now,
    }).where(eq(generationTasks.id, task.id)).returning();
    return updated[0];
  });
}

export async function convertEarningsToCredits(input: {
  userId: string;
  credits: number;
  idempotencyKey?: string;
}) {
  const credits = Math.trunc(input.credits);
  if (credits < 1 || credits > 1_000) throw new Error("兑换次数必须在 1 到 1000 之间");
  const amountFen = credits * EARNING_TO_CREDIT_FEN;
  const idempotencyKey = input.idempotencyKey || randomUUID();
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${creatorProfiles.userId} from ${creatorProfiles} where ${creatorProfiles.userId} = ${input.userId} for update`);
    const profiles = await transaction.select().from(creatorProfiles).where(eq(creatorProfiles.userId, input.userId)).limit(1);
    if (profiles[0]?.status !== "ACTIVE") throw new Error("请先开通创作者中心");
    const existing = await transaction.select().from(creatorEarningLedger)
      .where(eq(creatorEarningLedger.idempotencyKey, `creator-conversion:${idempotencyKey}`)).limit(1);
    if (existing[0]) return { credits, amountFen, duplicate: true };

    const sums = await transaction.select({ value: sql<number>`coalesce(sum(${creatorEarningLedger.deltaFen}), 0)` })
      .from(creatorEarningLedger).where(and(
        eq(creatorEarningLedger.creatorUserId, input.userId),
        lte(creatorEarningLedger.availableAt, new Date()),
      ));
    if (Number(sums[0]?.value ?? 0) < amountFen) throw new Error("可用收益不足");

    const ledgerRows = await transaction.insert(creatorEarningLedger).values({
      creatorUserId: input.userId,
      type: "CONVERSION_DEBIT",
      deltaFen: -amountFen,
      idempotencyKey: `creator-conversion:${idempotencyKey}`,
      metadata: { credits },
    }).returning({ id: creatorEarningLedger.id });
    await transaction.insert(rewardCreditWallets).values({ userId: input.userId }).onConflictDoNothing();
    const wallets = await transaction.update(rewardCreditWallets).set({
      balanceCredits: sql`${rewardCreditWallets.balanceCredits} + ${credits}`,
      updatedAt: new Date(),
    }).where(eq(rewardCreditWallets.userId, input.userId)).returning({ balanceCredits: rewardCreditWallets.balanceCredits });
    await transaction.insert(rewardCreditLedger).values({
      userId: input.userId,
      type: "EARNING_CONVERSION",
      deltaCredits: credits,
      balanceAfter: wallets[0].balanceCredits,
      idempotencyKey: `creator-conversion:${idempotencyKey}:credits`,
      referenceType: "CREATOR_EARNING_LEDGER",
      referenceId: ledgerRows[0].id,
    });
    return { credits, amountFen, balanceCredits: wallets[0].balanceCredits, duplicate: false };
  });
}

export async function createCreatorWithdrawal(input: {
  userId: string;
  amountFen: number;
  payeeName: string;
  alipayAccount: string;
  contactEmail: string;
}) {
  const amountFen = Math.trunc(input.amountFen);
  const payeeName = input.payeeName.trim();
  const alipayAccount = input.alipayAccount.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (amountFen < MIN_WITHDRAWAL_FEN) throw new Error("最低提现金额为 50 元");
  if (!payeeName || payeeName.length > 50) throw new Error("请填写支付宝实名");
  if (!alipayAccount || alipayAccount.length > 100) throw new Error("请填写支付宝账号");
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) throw new Error("请填写有效的联系邮箱");

  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${creatorProfiles.userId} from ${creatorProfiles} where ${creatorProfiles.userId} = ${input.userId} for update`);
    const profiles = await transaction.select().from(creatorProfiles).where(eq(creatorProfiles.userId, input.userId)).limit(1);
    if (profiles[0]?.status !== "ACTIVE") throw new Error("请先开通创作者中心");
    const sums = await transaction.select({ value: sql<number>`coalesce(sum(${creatorEarningLedger.deltaFen}), 0)` })
      .from(creatorEarningLedger).where(and(
        eq(creatorEarningLedger.creatorUserId, input.userId),
        lte(creatorEarningLedger.availableAt, new Date()),
      ));
    if (Number(sums[0]?.value ?? 0) < amountFen) throw new Error("可提现收益不足");

    const withdrawals = await transaction.insert(creatorWithdrawals).values({
      userId: input.userId,
      amountFen,
      payeeNameEncrypted: encryptPayoutValue(payeeName),
      alipayAccountEncrypted: encryptPayoutValue(alipayAccount),
      payeeNameMasked: maskName(payeeName),
      alipayAccountMasked: maskAccount(alipayAccount),
      contactEmail,
    }).returning();
    const withdrawal = withdrawals[0];
    await transaction.insert(creatorEarningLedger).values({
      creatorUserId: input.userId,
      type: "WITHDRAWAL_RESERVE",
      deltaFen: -amountFen,
      idempotencyKey: `creator-withdrawal:${withdrawal.id}:reserve`,
      metadata: { withdrawalId: withdrawal.id },
    });
    return mapWithdrawal(withdrawal);
  });
}

export async function listCreatorWithdrawalsForAdmin() {
  const rows = await getDatabase().select({
    withdrawal: creatorWithdrawals,
    creatorName: creatorProfiles.displayName,
    email: authIdentities.identifier,
  }).from(creatorWithdrawals)
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, creatorWithdrawals.userId))
    .innerJoin(authIdentities, and(
      eq(authIdentities.userId, creatorWithdrawals.userId),
      eq(authIdentities.type, "EMAIL"),
    ))
    .orderBy(desc(creatorWithdrawals.createdAt)).limit(100);
  return rows.map((item) => ({
    ...mapWithdrawal(item.withdrawal, true),
    creatorName: item.creatorName,
    email: item.email,
  }));
}

export async function updateCreatorWithdrawal(input: {
  withdrawalId: string;
  action: "approve" | "paid" | "reject";
  adminEmail: string;
  note?: string;
  transferReference?: string;
}) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${creatorWithdrawals.id} from ${creatorWithdrawals} where ${creatorWithdrawals.id} = ${input.withdrawalId} for update`);
    const rows = await transaction.select().from(creatorWithdrawals)
      .where(eq(creatorWithdrawals.id, input.withdrawalId)).limit(1);
    const current = rows[0];
    if (!current) throw new Error("提现申请不存在");
    const now = new Date();

    if (input.action === "approve") {
      if (current.status !== "PENDING") throw new Error("只有待审核申请可以通过");
      const updated = await transaction.update(creatorWithdrawals).set({
        status: "APPROVED",
        reviewNote: input.note?.trim().slice(0, 500) || null,
        reviewedBy: input.adminEmail,
        reviewedAt: now,
        updatedAt: now,
      }).where(eq(creatorWithdrawals.id, current.id)).returning();
      return mapWithdrawal(updated[0], true);
    }
    if (input.action === "paid") {
      if (current.status !== "APPROVED") throw new Error("请先审核通过，再登记付款");
      const reference = input.transferReference?.trim().slice(0, 120);
      if (!reference) throw new Error("请填写支付宝转账单号或备注");
      const updated = await transaction.update(creatorWithdrawals).set({
        status: "PAID",
        transferReference: reference,
        paidAt: now,
        updatedAt: now,
      }).where(eq(creatorWithdrawals.id, current.id)).returning();
      return mapWithdrawal(updated[0], true);
    }
    if (current.status !== "PENDING" && current.status !== "APPROVED") {
      throw new Error("当前申请不能驳回");
    }
    await transaction.insert(creatorEarningLedger).values({
      creatorUserId: current.userId,
      type: "WITHDRAWAL_RELEASE",
      deltaFen: current.amountFen,
      idempotencyKey: `creator-withdrawal:${current.id}:release`,
      metadata: { withdrawalId: current.id },
    }).onConflictDoNothing();
    const updated = await transaction.update(creatorWithdrawals).set({
      status: "REJECTED",
      reviewNote: input.note?.trim().slice(0, 500) || "管理员驳回",
      reviewedBy: input.adminEmail,
      reviewedAt: now,
      updatedAt: now,
    }).where(eq(creatorWithdrawals.id, current.id)).returning();
    return mapWithdrawal(updated[0], true);
  });
}

export async function creatorAdminCounts() {
  const rows = await getDatabase().select({
    pendingWithdrawals: sql<number>`count(*) filter (where ${creatorWithdrawals.status} = 'PENDING')`,
  }).from(creatorWithdrawals);
  return { pendingWithdrawals: Number(rows[0]?.pendingWithdrawals ?? 0) };
}
