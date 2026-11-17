import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { processComparisonImage } from "@/lib/comparison-image-processor";
import { CREATOR_REWARD_FEN, getCreatorProfile } from "@/lib/creator-store";
import { displayImageSize, resolveBoxAIImageSize } from "@/lib/image-sizes";
import { requireSameOrigin } from "@/lib/payment-session";
import {
  getAllTemplates,
  makeSlug,
  mutateTemplates,
  saveTemplateImageBuffer,
} from "@/lib/template-store";
import { deriveImportFields, normalizeNegativePrompt, normalizeStyleOnlyPrompt } from "@/lib/template-import-rules";
import type { ExamplePair, StudioTemplate } from "@/lib/template-types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireAuthenticatedUser(request);
    const profile = await getCreatorProfile(user.id);
    if (!profile || profile.status !== "ACTIVE") {
      return Response.json({ error: "请先开通创作者中心" }, { status: 403 });
    }

    const formData = await request.formData();
    const rawText = text(formData, "rawText");
    if (rawText.length < 20 || rawText.length > 30_000) {
      return Response.json({ error: "提示词需要在 20 到 30000 个字符之间" }, { status: 400 });
    }
    if (formData.get("rightsConfirmed") !== "on") {
      return Response.json({ error: "请确认你拥有案例图和提示词的发布与商业使用权" }, { status: 400 });
    }
    const compositeFiles = formData.getAll("compositeImages")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (!compositeFiles.length || compositeFiles.length > 8) {
      return Response.json({ error: "请上传 1 到 8 张上下对照图" }, { status: 400 });
    }

    const derived = deriveImportFields(rawText);
    const name = (text(formData, "name") || derived.name).slice(0, 28);
    const templates = await getAllTemplates();
    const baseSlug = makeSlug(name);
    let slug = baseSlug;
    let suffix = 2;
    while (templates.some((item) => item.slug === slug)) slug = `${baseSlug}-${suffix++}`;

    const examples: ExamplePair[] = [];
    let coverImage = "";
    const cleanScreenshotUi = formData.get("cleanScreenshotUi") === "on";
    for (let index = 0; index < compositeFiles.length; index += 1) {
      const processed = await processComparisonImage(compositeFiles[index], { cleanScreenshotUi });
      const inputImage = await saveTemplateImageBuffer(processed.inputImage, `${slug}-before-${index + 1}`);
      const outputImage = await saveTemplateImageBuffer(processed.outputImage, `${slug}-after-${index + 1}`);
      const comparisonImage = await saveTemplateImageBuffer(processed.comparisonImage, `${slug}-comparison-${index + 1}`);
      if (!coverImage) coverImage = comparisonImage;
      examples.push({ id: randomUUID(), inputImage, outputImage });
    }

    const now = new Date().toISOString();
    const outputSize = displayImageSize(resolveBoxAIImageSize("", derived.ratio));
    const template: StudioTemplate = {
      id: randomUUID(),
      slug,
      name,
      tagline: (text(formData, "tagline") || derived.tagline).slice(0, 100),
      description: (text(formData, "description") || derived.description).slice(0, 500),
      category: derived.category,
      tags: derived.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      coverImage,
      examples,
      allowText: true,
      allowImage: true,
      textPlaceholder: "描述画面主体、场景或希望保留的细节",
      outputRatio: derived.ratio,
      outputSize,
      allowedCounts: [1, 2],
      priceCredits: 1,
      providerId: "boxai",
      model: "gpt-image-2.5-flare",
      privatePrompt: normalizeStyleOnlyPrompt(rawText),
      negativePrompt: normalizeNegativePrompt(""),
      status: "pending_review",
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
      source: {
        platform: "other",
        author: profile.displayName,
        rightsStatus: "self_created",
        rawText,
        collectedAt: now,
      },
      ownerType: "creator",
      ownerUserId: user.id,
      creatorName: profile.displayName,
      creatorRewardFen: CREATOR_REWARD_FEN,
    };
    const saved = await mutateTemplates((current) => {
      let finalSlug = template.slug;
      let finalSuffix = 2;
      while (current.some((item) => item.slug === finalSlug)) finalSlug = `${template.slug}-${finalSuffix++}`;
      const finalTemplate = finalSlug === template.slug ? template : { ...template, slug: finalSlug };
      return { templates: [finalTemplate, ...current], result: finalTemplate };
    });
    return Response.json({ id: saved.id, status: saved.status }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模板投稿失败";
    const status = error instanceof AuthenticationError ? 401 : message.includes("请求来源") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
