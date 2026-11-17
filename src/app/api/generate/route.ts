import { type NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import {
  CREATOR_REWARD_FEN,
  releaseRewardGeneration,
  settleRewardGeneration,
  tryReserveRewardGeneration,
} from "@/lib/creator-store";
import { runGeneration } from "@/lib/generation";
import { isNowPayDirectEnabled, queryNowPayQuota } from "@/lib/nowpay-direct";
import { confirmNowPayConsumption, publicNowPayAttempt } from "@/lib/nowpay-service";
import {
  createNowPayGenerationAttempt,
  failNowPayGeneration,
  saveNowPayGeneratedResults,
} from "@/lib/nowpay-store";
import { requireSameOrigin } from "@/lib/payment-session";
import {
  releaseGeneration,
  reserveGeneration,
  settleGeneration,
} from "@/lib/payment-store";
import {
  cleanupExpiredTemporaryInputs,
  getTemplateById,
  saveTemporaryInput,
} from "@/lib/template-store";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "请求来源校验失败" },
      { status: 403 },
    );
  }
  let user;
  try {
    user = await authenticateRequest(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "账户服务暂不可用" },
      { status: 503 },
    );
  }
  if (!user) {
    return Response.json(
      { error: "请先登录后再开始创作", loginRequired: true },
      { status: 401 },
    );
  }
  const formData = await request.formData();
  const templateId = String(formData.get("templateId") ?? "");
  const userText = String(formData.get("userText") ?? "").trim();
  const requestedCount = Number(formData.get("count") ?? 1);
  const inputImage = formData.get("inputImage");
  const hasImage = inputImage instanceof File && inputImage.size > 0;

  const template = await getTemplateById(templateId);
  if (!template || template.status !== "published") {
    return Response.json({ error: "模板不存在或尚未发布" }, { status: 404 });
  }
  if (!userText && !hasImage) {
    return Response.json({ error: "请至少提供文字或图片中的一种" }, { status: 400 });
  }
  if (userText && !template.allowText) {
    return Response.json({ error: "这个模板不支持文字输入" }, { status: 400 });
  }
  if (hasImage && !template.allowImage) {
    return Response.json({ error: "这个模板不支持图片输入" }, { status: 400 });
  }
  if (!template.allowedCounts.includes(requestedCount)) {
    return Response.json({ error: "不支持所选生成数量" }, { status: 400 });
  }

  const requiredCredits = requestedCount * template.priceCredits;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const templateOwnerUserId = template.ownerType === "creator" ? template.ownerUserId : undefined;
  const creatorRewardFen = templateOwnerUserId
    ? template.creatorRewardFen ?? CREATOR_REWARD_FEN
    : 0;

  const rewardReservation = await tryReserveRewardGeneration({
    userId: user.id,
    templateId: template.id,
    provider: template.providerId,
    model: template.model,
    requestedCount,
    requiredCredits,
    expiresAt,
    templateOwnerUserId,
    creatorRewardFen,
  });
  if (rewardReservation.ok) {
    try {
      await cleanupExpiredTemporaryInputs();
      const inputImagePath = hasImage
        ? await saveTemporaryInput(inputImage, `temporary-${template.slug}`)
        : undefined;
      const result = await runGeneration(
        template,
        userText,
        inputImagePath,
        requestedCount,
        rewardReservation.task.id,
      );
      await settleRewardGeneration(rewardReservation.task.id, result.images);
      return Response.json({
        taskId: rewardReservation.task.id,
        status: "completed",
        images: result.images,
        expiresAt: expiresAt.toISOString(),
        fundingSource: "reward_credits",
        rewardCreditsRemaining: rewardReservation.balanceCredits,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生图服务调用失败";
      await releaseRewardGeneration(rewardReservation.task.id, message).catch(() => undefined);
      const status = message.includes("尚未配置") ? 503 : 502;
      return Response.json({ error: `${message}。本次平台奖励次数已退回` }, { status });
    }
  }

  if (isNowPayDirectEnabled()) {
    let taskId: string | undefined;
    try {
      const quota = await queryNowPayQuota(user.id);
      if (quota.remaining < requiredCredits) {
        return Response.json(
          {
            error: `创作次数不足，本次需要 ${requiredCredits} 次，当前剩余 ${quota.remaining} 次`,
            paymentRequired: true,
            balanceCredits: quota.remaining,
          },
          { status: 402 },
        );
      }
      const attempt = await createNowPayGenerationAttempt({
        userId: user.id,
        templateId: template.id,
        provider: template.providerId,
        model: template.model,
        requestedCount,
        requiredCredits,
        expiresAt,
        templateOwnerUserId,
        creatorRewardFen,
      });
      taskId = attempt.task.id;
      await cleanupExpiredTemporaryInputs();
      const inputImagePath = hasImage
        ? await saveTemporaryInput(inputImage, `temporary-${template.slug}`)
        : undefined;
      const result = await runGeneration(template, userText, inputImagePath, requestedCount, taskId);
      await saveNowPayGeneratedResults(taskId, result.images);
      const confirmed = await confirmNowPayConsumption(taskId, user.id);
      const body = publicNowPayAttempt(confirmed);
      if (!body) throw new Error("创作任务不存在");
      if (confirmed.consumption.status === "FAILED") {
        return Response.json(body, { status: body.paymentRequired ? 402 : 409 });
      }
      if (confirmed.consumption.status !== "SUCCEEDED") return Response.json(body, { status: 202 });
      return Response.json(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生图服务调用失败";
      if (taskId) await failNowPayGeneration(taskId, message).catch(() => undefined);
      const status = message.includes("尚未配置") ? 503 : 502;
      const publicMessage = message.includes("不会扣除创作次数")
        ? message
        : `${message}。本次未扣除创作次数`;
      return Response.json({ error: publicMessage }, { status });
    }
  }

  const reservation = await reserveGeneration({
    userId: user.id,
    templateId: template.id,
    credits: requiredCredits,
    provider: template.providerId,
    model: template.model,
    requestedCount,
    expiresAt,
    templateOwnerUserId,
    creatorRewardFen,
  });
  if (!reservation.ok) {
    return Response.json(
      {
        error: `创作次数不足，本次需要 ${requiredCredits} 次，当前剩余 ${reservation.balanceCredits} 次`,
        paymentRequired: true,
        balanceCredits: reservation.balanceCredits,
      },
      { status: 402 },
    );
  }

  try {
    await cleanupExpiredTemporaryInputs();
    const inputImagePath = hasImage
      ? await saveTemporaryInput(inputImage, `temporary-${template.slug}`)
      : undefined;
    const result = await runGeneration(
      template,
      userText,
      inputImagePath,
      requestedCount,
      reservation.taskId,
    );
    await settleGeneration(
      reservation.reservationId,
      result.images.length * template.priceCredits,
      result.images.length,
    );
    return Response.json({
      taskId: reservation.taskId,
      status: "completed",
      images: result.images,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    await releaseGeneration(reservation.reservationId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "生图服务调用失败";
    const status = message.includes("尚未配置") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
