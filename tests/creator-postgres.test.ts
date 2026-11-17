import assert from "node:assert/strict";
import test from "node:test";

import { and, eq } from "drizzle-orm";

import { getDatabase } from "../src/db/client";
import {
  creatorEarningLedger,
  creatorProfiles,
  generationTasks,
  rewardCreditWallets,
  users,
} from "../src/db/schema";
import {
  awardCreatorForCompletedTask,
  convertEarningsToCredits,
  createCreatorWithdrawal,
  getCreatorDashboard,
  releaseRewardGeneration,
  tryReserveRewardGeneration,
  updateCreatorWithdrawal,
} from "../src/lib/creator-store";

const databaseUrl = process.env.DATABASE_URL?.trim();

test("creator rewards, conversion, withdrawal and reward-credit invariants", { skip: !databaseUrl }, async () => {
  process.env.APP_SESSION_SECRET ||= "creator-test-secret-that-is-longer-than-thirty-two-characters";
  const db = getDatabase();
  const [creator, customer] = await db.insert(users).values([{}, {}]).returning({ id: users.id });
  await db.insert(creatorProfiles).values({ userId: creator.id, displayName: "Test Creator" });

  const oldCompletion = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const taskRows = await db.insert(generationTasks).values({
    userId: customer.id,
    templateId: "creator-test-template",
    provider: "boxai",
    model: "test-model",
    requestedCount: 1,
    successfulCount: 1,
    status: "COMPLETED",
    fundingSource: "NOWPAY",
    templateOwnerUserId: creator.id,
    creatorRewardFen: 20,
    expiresAt: new Date(Date.now() + 60_000),
    completedAt: oldCompletion,
  }).returning({ id: generationTasks.id });
  const taskId = taskRows[0].id;

  await Promise.all([
    awardCreatorForCompletedTask(taskId),
    awardCreatorForCompletedTask(taskId),
  ]);
  const rewards = await db.select().from(creatorEarningLedger)
    .where(eq(creatorEarningLedger.idempotencyKey, `creator-reward:${taskId}`));
  assert.equal(rewards.length, 1, "one completed task earns exactly once");
  assert.equal(rewards[0].deltaFen, 20);

  const selfTask = await db.insert(generationTasks).values({
    userId: creator.id,
    templateId: "creator-self-template",
    provider: "boxai",
    model: "test-model",
    requestedCount: 1,
    successfulCount: 1,
    status: "COMPLETED",
    fundingSource: "NOWPAY",
    templateOwnerUserId: creator.id,
    creatorRewardFen: 20,
    expiresAt: new Date(Date.now() + 60_000),
    completedAt: oldCompletion,
  }).returning({ id: generationTasks.id });
  await awardCreatorForCompletedTask(selfTask[0].id);
  const selfRewards = await db.select().from(creatorEarningLedger)
    .where(eq(creatorEarningLedger.idempotencyKey, `creator-reward:${selfTask[0].id}`));
  assert.equal(selfRewards.length, 0, "creators do not earn from their own template use");

  await db.insert(creatorEarningLedger).values({
    creatorUserId: creator.id,
    type: "ADJUSTMENT",
    deltaFen: 5_100,
    idempotencyKey: `creator-test-adjustment:${creator.id}`,
  });
  await Promise.all([
    convertEarningsToCredits({ userId: creator.id, credits: 1, idempotencyKey: "same-conversion" }),
    convertEarningsToCredits({ userId: creator.id, credits: 1, idempotencyKey: "same-conversion" }),
  ]);
  let rewardWallet = await db.select().from(rewardCreditWallets)
    .where(eq(rewardCreditWallets.userId, creator.id));
  assert.equal(rewardWallet[0].balanceCredits, 1, "conversion is idempotent");

  const reservation = await tryReserveRewardGeneration({
    userId: creator.id,
    templateId: "reward-credit-test",
    provider: "boxai",
    model: "test-model",
    requestedCount: 1,
    requiredCredits: 1,
    expiresAt: new Date(Date.now() + 60_000),
    creatorRewardFen: 0,
  });
  assert.equal(reservation.ok, true);
  if (!reservation.ok) throw new Error("reward reservation unexpectedly failed");
  await Promise.all([
    releaseRewardGeneration(reservation.task.id, "test failure"),
    releaseRewardGeneration(reservation.task.id, "test failure"),
  ]);
  rewardWallet = await db.select().from(rewardCreditWallets)
    .where(eq(rewardCreditWallets.userId, creator.id));
  assert.equal(rewardWallet[0].balanceCredits, 1, "failed generation returns reward credits once");

  const withdrawals = await Promise.allSettled([
    createCreatorWithdrawal({
      userId: creator.id,
      amountFen: 5_000,
      payeeName: "测试用户",
      alipayAccount: "test@example.com",
      contactEmail: "test@example.com",
    }),
    createCreatorWithdrawal({
      userId: creator.id,
      amountFen: 5_000,
      payeeName: "测试用户",
      alipayAccount: "test@example.com",
      contactEmail: "test@example.com",
    }),
  ]);
  assert.equal(withdrawals.filter((item) => item.status === "fulfilled").length, 1, "concurrent withdrawals cannot overspend available earnings");
  const successful = withdrawals.find((item) => item.status === "fulfilled");
  if (!successful || successful.status !== "fulfilled") throw new Error("withdrawal missing");
  await updateCreatorWithdrawal({
    withdrawalId: successful.value.id,
    action: "reject",
    adminEmail: "admin@example.com",
    note: "integration test release",
  });
  const dashboard = await getCreatorDashboard(creator.id);
  assert.equal(dashboard.balances.availableFen, 5_070, "rejected withdrawal releases the reserved earnings");

  const releaseRows = await db.select().from(creatorEarningLedger).where(and(
    eq(creatorEarningLedger.creatorUserId, creator.id),
    eq(creatorEarningLedger.type, "WITHDRAWAL_RELEASE"),
  ));
  assert.equal(releaseRows.length, 1);
});
