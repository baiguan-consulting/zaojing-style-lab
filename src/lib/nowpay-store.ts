import "server-only";

import { randomBytes } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  creatorEarningLedger,
  creatorProfiles,
  generationTasks,
  nowpayConsumptions,
  nowpayPurchaseRequests,
} from "@/db/schema";
import { CREATOR_HOLD_DAYS } from "./creator-store";
import { getNowPayProductId } from "./nowpay-direct";

export type NowPayConsumptionStatus = "PREPARED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";

function requestNo(prefix: "NPBUY" | "NPCONSUME") {
  return `${prefix}${Date.now()}${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function createNowPayPurchaseRequest(input: {
  userId: string;
  externalBuyerId: string;
  skuId?: string;
  remainingBefore: number;
  optionSnapshot?: Record<string, unknown>;
}) {
  const rows = await getDatabase()
    .insert(nowpayPurchaseRequests)
    .values({
      userId: input.userId,
      outRequestNo: requestNo("NPBUY"),
      productId: getNowPayProductId(),
      skuId: input.skuId,
      externalBuyerId: input.externalBuyerId,
      remainingBefore: input.remainingBefore,
      optionSnapshot: input.optionSnapshot,
    })
    .returning();
  return rows[0];
}

export async function updateNowPayPurchaseRequest(
  id: string,
  values: Partial<{
    status: string;
    expiresAt: Date;
    returnedAt: Date;
    completedAt: Date;
  }>,
) {
  const rows = await getDatabase()
    .update(nowpayPurchaseRequests)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(nowpayPurchaseRequests.id, id))
    .returning();
  return rows[0];
}

export async function getNowPayPurchaseForUser(id: string, userId: string) {
  const rows = await getDatabase()
    .select()
    .from(nowpayPurchaseRequests)
    .where(and(eq(nowpayPurchaseRequests.id, id), eq(nowpayPurchaseRequests.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listNowPayPurchases(userId: string) {
  return getDatabase()
    .select()
    .from(nowpayPurchaseRequests)
    .where(eq(nowpayPurchaseRequests.userId, userId))
    .orderBy(desc(nowpayPurchaseRequests.createdAt))
    .limit(10);
}

export async function createNowPayGenerationAttempt(input: {
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
  return getDatabase().transaction(async (transaction) => {
    const taskRows = await transaction
      .insert(generationTasks)
      .values({
        userId: input.userId,
        templateId: input.templateId,
        provider: input.provider,
        model: input.model,
        requestedCount: input.requestedCount,
        fundingSource: "NOWPAY",
        templateOwnerUserId: input.templateOwnerUserId,
        creatorRewardFen: input.creatorRewardFen,
        status: "RUNNING",
        expiresAt: input.expiresAt,
      })
      .returning();
    const task = taskRows[0];
    const consumptionRows = await transaction
      .insert(nowpayConsumptions)
      .values({
        userId: input.userId,
        taskId: task.id,
        outRequestNo: requestNo("NPCONSUME"),
        productId: getNowPayProductId(),
        externalBuyerId: input.userId,
        amount: input.requiredCredits,
        consumeReason: `造境 AI 图片创作 ${input.requestedCount} 张`,
      })
      .returning();
    return { task, consumption: consumptionRows[0] };
  });
}

export async function saveNowPayGeneratedResults(taskId: string, imageUrls: string[]) {
  const rows = await getDatabase()
    .update(generationTasks)
    .set({
      resultUrls: imageUrls,
      successfulCount: imageUrls.length,
      status: "AWAITING_QUOTA",
      updatedAt: new Date(),
    })
    .where(eq(generationTasks.id, taskId))
    .returning();
  return rows[0];
}

export async function failNowPayGeneration(taskId: string, errorMessage: string) {
  return getDatabase().transaction(async (transaction) => {
    const now = new Date();
    const rows = await transaction
      .update(generationTasks)
      .set({
        status: "FAILED",
        errorMessage: errorMessage.slice(0, 500),
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(generationTasks.id, taskId))
      .returning();
    await transaction
      .update(nowpayConsumptions)
      .set({
        status: "FAILED",
        providerCode: "GENERATION_FAILED",
        completedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(nowpayConsumptions.taskId, taskId),
        eq(nowpayConsumptions.status, "PREPARED"),
      ));
    return rows[0];
  });
}

export async function getNowPayAttemptForUser(taskId: string, userId: string) {
  const rows = await getDatabase()
    .select({ task: generationTasks, consumption: nowpayConsumptions })
    .from(generationTasks)
    .innerJoin(nowpayConsumptions, eq(nowpayConsumptions.taskId, generationTasks.id))
    .where(and(eq(generationTasks.id, taskId), eq(generationTasks.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function setNowPayConsumptionResult(input: {
  consumptionId: string;
  status: NowPayConsumptionStatus;
  providerCode?: string;
  providerSubCode?: string;
  consumed?: number;
  remaining?: number;
  errorMessage?: string;
}) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select ${nowpayConsumptions.id} from ${nowpayConsumptions} where ${nowpayConsumptions.id} = ${input.consumptionId} for update`);
    const currentRows = await transaction
      .select()
      .from(nowpayConsumptions)
      .where(eq(nowpayConsumptions.id, input.consumptionId))
      .limit(1);
    const current = currentRows[0];
    if (!current) throw new Error("次数核销记录不存在");
    if (current.status === "SUCCEEDED" || current.status === "FAILED") return current;

    const completed = input.status === "SUCCEEDED" || input.status === "FAILED";
    const consumptionRows = await transaction
      .update(nowpayConsumptions)
      .set({
        status: input.status,
        providerCode: input.providerCode,
        providerSubCode: input.providerSubCode,
        consumed: input.consumed,
        remaining: input.remaining,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(nowpayConsumptions.id, current.id))
      .returning();

    if (input.status === "SUCCEEDED") {
      const completedAt = new Date();
      const tasks = await transaction
        .update(generationTasks)
        .set({ status: "COMPLETED", completedAt, updatedAt: completedAt })
        .where(eq(generationTasks.id, current.taskId))
        .returning();
      const task = tasks[0];
      if (
        task?.templateOwnerUserId
        && task.templateOwnerUserId !== task.userId
        && task.creatorRewardFen > 0
        && task.successfulCount > 0
      ) {
        const profiles = await transaction.select({ status: creatorProfiles.status })
          .from(creatorProfiles).where(eq(creatorProfiles.userId, task.templateOwnerUserId)).limit(1);
        if (profiles[0]?.status === "ACTIVE") {
          await transaction.insert(creatorEarningLedger).values({
            creatorUserId: task.templateOwnerUserId,
            generationTaskId: task.id,
            templateId: task.templateId,
            type: "GENERATION_REWARD",
            deltaFen: task.successfulCount * task.creatorRewardFen,
            availableAt: new Date(completedAt.getTime() + CREATOR_HOLD_DAYS * 24 * 60 * 60 * 1000),
            idempotencyKey: `creator-reward:${task.id}`,
            metadata: {
              successfulCount: task.successfulCount,
              rewardFenPerImage: task.creatorRewardFen,
              fundingSource: task.fundingSource,
            },
          }).onConflictDoNothing();
        }
      }
    } else if (input.status === "FAILED") {
      await transaction
        .update(generationTasks)
        .set({
          status: "FAILED",
          errorMessage: (input.errorMessage || "创作次数核销失败").slice(0, 500),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationTasks.id, current.taskId));
    }
    return consumptionRows[0];
  });
}
