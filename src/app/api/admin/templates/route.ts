import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import { processComparisonImage } from "@/lib/comparison-image-processor";
import {
  displayImageSize,
  normalizeBoxAIRatio,
  resolveBoxAIHighImageSize,
  resolveBoxAIImageSize,
} from "@/lib/image-sizes";
import {
  getAllTemplates,
  makeSlug,
  mutateTemplates,
  saveTemplateImageBuffer,
  saveUploadedImage,
} from "@/lib/template-store";
import { normalizeNegativePrompt, normalizeStyleOnlyPrompt } from "@/lib/template-import-rules";
import type {
  ExamplePair,
  StudioTemplate,
  TemplateSource,
  TemplateTranslations,
} from "@/lib/template-types";
import { requireSameOrigin } from "@/lib/payment-session";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "管理员接口未授权" },
      { status: error instanceof AdminAuthorizationError ? error.status : 403 },
    );
  }
  const formData = await request.formData();
  const name = text(formData, "name");
  const category = text(formData, "category");
  const tagline = text(formData, "tagline");
  const description = text(formData, "description");
  const autoCompositeImport = text(formData, "importMode") === "composite-auto";
  const privatePrompt = autoCompositeImport
    ? normalizeStyleOnlyPrompt(text(formData, "privatePrompt"))
    : text(formData, "privatePrompt");
  const allowText = formData.get("allowText") === "on";
  const allowImage = formData.get("allowImage") === "on";

  if (!name || !category || !tagline || !description || !privatePrompt) {
    return Response.json({ error: "请完整填写模板名称、分类、介绍、说明和固定提示词" }, { status: 400 });
  }
  if (!allowText && !allowImage) {
    return Response.json({ error: "至少允许用户提供文字或图片中的一种" }, { status: 400 });
  }
  if (privatePrompt.length > 30_000) {
    return Response.json({ error: "固定提示词不能超过 30000 个字符" }, { status: 400 });
  }
  const model = text(formData, "model");
  if (!["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].includes(model)) {
    return Response.json({ error: "请选择有效的 BoxAI 生成模型" }, { status: 400 });
  }

  const sourceUrl = text(formData, "sourceUrl");
  const sourceAuthor = text(formData, "sourceAuthor").slice(0, 100);
  const rawSourceText = text(formData, "rawSourceText").slice(0, 30_000);
  const requestedRightsStatus = text(formData, "rightsStatus");
  const rightsStatus: TemplateSource["rightsStatus"] = ["reference_only", "authorized", "self_created"].includes(requestedRightsStatus)
    ? requestedRightsStatus as TemplateSource["rightsStatus"]
    : "self_created";
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return Response.json({ error: "来源链接必须是有效的 HTTP 或 HTTPS 地址" }, { status: 400 });
    }
  }
  const wantsPublished = text(formData, "submitIntent") !== "draft";
  if (wantsPublished && rightsStatus === "reference_only") {
    return Response.json({ error: "仅供参考的素材只能保存为草稿，确认授权或换成自有案例后才能发布" }, { status: 400 });
  }

  const inputFiles = formData.getAll("exampleInputs").filter((value): value is File => value instanceof File && value.size > 0);
  const outputFiles = formData.getAll("exampleOutputs").filter((value): value is File => value instanceof File && value.size > 0);
  const compositeFiles = formData.getAll("compositeImages").filter((value): value is File => value instanceof File && value.size > 0);
  if (autoCompositeImport) {
    if (!compositeFiles.length) {
      return Response.json({ error: "请至少上传一张上下对照效果图" }, { status: 400 });
    }
    if (compositeFiles.length > 8) {
      return Response.json({ error: "一次最多上传 8 张上下对照效果图" }, { status: 400 });
    }
  } else if (!inputFiles.length || inputFiles.length !== outputFiles.length) {
    return Response.json({ error: "每个案例都需要同时上传原图和效果图" }, { status: 400 });
  }

  const rawSlug = text(formData, "slug") || name;
  const baseSlug = makeSlug(rawSlug);
  const templates = await getAllTemplates();
  let slug = baseSlug;
  let suffix = 2;
  while (templates.some((item) => item.slug === slug)) slug = `${baseSlug}-${suffix++}`;

  const examples: ExamplePair[] = [];
  let coverImage = "";
  if (autoCompositeImport) {
    const cleanScreenshotUi = formData.get("cleanScreenshotUi") === "on";
    try {
      const processedImages = await Promise.all(
        compositeFiles.map((file) => processComparisonImage(file, { cleanScreenshotUi })),
      );
      for (let index = 0; index < processedImages.length; index += 1) {
        const processed = processedImages[index];
        const inputImage = await saveTemplateImageBuffer(processed.inputImage, `${slug}-before-${index + 1}`);
        const outputImage = await saveTemplateImageBuffer(processed.outputImage, `${slug}-after-${index + 1}`);
        const comparisonImage = await saveTemplateImageBuffer(processed.comparisonImage, `${slug}-comparison-${index + 1}`);
        if (!coverImage) coverImage = comparisonImage;
        examples.push({ id: randomUUID(), inputImage, outputImage });
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "上下对照图自动拆分失败" },
        { status: 400 },
      );
    }
  } else {
    for (let index = 0; index < inputFiles.length; index += 1) {
      const inputImage = await saveUploadedImage(inputFiles[index], `${slug}-before-${index + 1}`);
      const outputImage = await saveUploadedImage(outputFiles[index], `${slug}-after-${index + 1}`);
      examples.push({ id: randomUUID(), inputImage, outputImage });
    }
    const coverFile = formData.get("coverImage");
    coverImage = coverFile instanceof File && coverFile.size > 0
      ? await saveUploadedImage(coverFile, `${slug}-cover`)
      : examples[0].outputImage;
  }
  const now = new Date().toISOString();
  const allowedCounts = formData.get("allowCount2") === "on" ? [1, 2] : [1];
  const outputRatio = normalizeBoxAIRatio(text(formData, "outputRatio"));
  const requestedOutputSize = text(formData, "outputSize") || resolveBoxAIHighImageSize(outputRatio);
  const outputSize = displayImageSize(
    resolveBoxAIImageSize(requestedOutputSize, outputRatio),
  );

  const collectedAt = new Date().toISOString();
  const source: TemplateSource | undefined = sourceUrl || sourceAuthor || rawSourceText
    ? {
        platform: /xiaohongshu\.com|xhslink\.com/i.test(sourceUrl) ? "xiaohongshu" : "other",
        url: sourceUrl || undefined,
        author: sourceAuthor || undefined,
        rightsStatus,
        rawText: rawSourceText || undefined,
        collectedAt,
      }
    : undefined;
  const englishTags = text(formData, "tagsEn").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const englishTranslation = {
    name: text(formData, "nameEn") || undefined,
    tagline: text(formData, "taglineEn") || undefined,
    description: text(formData, "descriptionEn") || undefined,
    category: text(formData, "categoryEn") || undefined,
    tags: englishTags.length ? englishTags : undefined,
    textPlaceholder: text(formData, "textPlaceholderEn") || undefined,
  };
  const translations: TemplateTranslations | undefined = Object.values(englishTranslation).some(Boolean)
    ? { en: englishTranslation }
    : undefined;
  const template: StudioTemplate = {
    id: randomUUID(),
    slug,
    name,
    tagline,
    description,
    category,
    tags: text(formData, "tags").split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    coverImage,
    examples,
    allowText,
    allowImage,
    textPlaceholder: text(formData, "textPlaceholder") || "描述画面主体、场景或希望保留的细节",
    outputRatio,
    outputSize,
    allowedCounts,
    priceCredits: Math.max(1, Number(formData.get("priceCredits") ?? 1)),
    providerId: "boxai",
    model,
    privatePrompt,
    negativePrompt: autoCompositeImport
      ? normalizeNegativePrompt(text(formData, "negativePrompt"))
      : text(formData, "negativePrompt"),
    status: wantsPublished ? "published" : "draft",
    isFeatured: formData.get("isFeatured") === "on",
    createdAt: now,
    updatedAt: now,
    source,
    translations,
  };

  const saved = await mutateTemplates((current) => {
    let finalSlug = template.slug;
    let finalSuffix = 2;
    while (current.some((item) => item.slug === finalSlug)) finalSlug = `${template.slug}-${finalSuffix++}`;
    const finalTemplate = finalSlug === template.slug ? template : { ...template, slug: finalSlug };
    return { templates: [finalTemplate, ...current], result: finalTemplate };
  });
  return Response.json({ id: saved.id, slug: saved.slug, status: saved.status }, { status: 201 });
}
