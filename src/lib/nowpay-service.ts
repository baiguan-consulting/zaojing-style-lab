import "server-only";

import { awardCreatorForCompletedTask } from "./creator-store";
import {
  refreshNowPayQuota,
  verifyNowPayQuota,
  type NowPayConsumeResult,
} from "./nowpay-direct";
import {
  getNowPayAttemptForUser,
  setNowPayConsumptionResult,
} from "./nowpay-store";

function isInsufficient(result: NowPayConsumeResult) {
  return result.subCode === "NOW_PAY_QUOTA_INSUFFICIENT";
}

async function persistResult(consumptionId: string, result: NowPayConsumeResult) {
  if (result.code === "10000" && result.status === "SUCCEEDED") {
    await setNowPayConsumptionResult({
      consumptionId,
      status: "SUCCEEDED",
      providerCode: result.code,
      providerSubCode: result.subCode,
      consumed: result.consumed,
      remaining: result.remaining,
    });
    return "SUCCEEDED" as const;
  }
  if ((result.code === "10000" && result.status === "FAILED") || isInsufficient(result)) {
    await setNowPayConsumptionResult({
      consumptionId,
      status: "FAILED",
      providerCode: result.code,
      providerSubCode: result.subCode,
      consumed: result.consumed,
      remaining: result.remaining,
      errorMessage: isInsufficient(result) ? "创作次数不足，请购买次数后重试" : "支付宝次数核销未通过",
    });
    return "FAILED" as const;
  }
  await setNowPayConsumptionResult({
    consumptionId,
    status: result.status === "PROCESSING" ? "PROCESSING" : "UNKNOWN",
    providerCode: result.code,
    providerSubCode: result.subCode,
    consumed: result.consumed,
    remaining: result.remaining,
  });
  return result.status === "PROCESSING" ? "PROCESSING" as const : "UNKNOWN" as const;
}

export async function confirmNowPayConsumption(taskId: string, userId: string) {
  const attempt = await getNowPayAttemptForUser(taskId, userId);
  if (!attempt) throw new Error("创作任务不存在");
  if (attempt.consumption.status === "SUCCEEDED") {
    await awardCreatorForCompletedTask(taskId);
    return attempt;
  }
  if (attempt.consumption.status === "FAILED") return attempt;
  if (!attempt.task.resultUrls?.length) throw new Error("创作结果尚未准备完成");

  try {
    const input = {
      outRequestNo: attempt.consumption.outRequestNo,
      externalBuyerId: attempt.consumption.externalBuyerId,
    };
    const result = attempt.consumption.status === "PREPARED"
      ? await verifyNowPayQuota({
        ...input,
        amount: attempt.consumption.amount,
        consumeReason: attempt.consumption.consumeReason,
      })
      : await refreshNowPayQuota(input);
    await persistResult(attempt.consumption.id, result);
    if (result.code === "10000" && result.status === "SUCCEEDED") {
      await awardCreatorForCompletedTask(taskId);
    }
  } catch {
    // A transport or unknown provider result must keep the original request
    // number so later polling can resolve it through quota.refresh safely.
    await setNowPayConsumptionResult({
      consumptionId: attempt.consumption.id,
      status: "UNKNOWN",
    });
  }
  const updated = await getNowPayAttemptForUser(taskId, userId);
  if (!updated) throw new Error("创作任务不存在");
  return updated;
}

export function publicNowPayAttempt(attempt: Awaited<ReturnType<typeof getNowPayAttemptForUser>>) {
  if (!attempt) return undefined;
  const completed = attempt.consumption.status === "SUCCEEDED";
  return {
    taskId: attempt.task.id,
    status: completed ? "completed" : attempt.consumption.status.toLowerCase(),
    images: completed ? attempt.task.resultUrls ?? [] : [],
    expiresAt: attempt.task.expiresAt.toISOString(),
    remaining: completed ? attempt.consumption.remaining : undefined,
    paymentRequired: attempt.consumption.providerSubCode === "NOW_PAY_QUOTA_INSUFFICIENT",
    error: attempt.consumption.status === "FAILED"
      ? attempt.task.errorMessage || "创作次数核销失败"
      : undefined,
  };
}
