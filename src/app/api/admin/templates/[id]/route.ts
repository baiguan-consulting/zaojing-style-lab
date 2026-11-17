import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { AdminAuthorizationError, requireAdminApiAccess } from "@/lib/admin-auth";
import {
  displayImageSize,
  normalizeBoxAIRatio,
  resolveBoxAIHighImageSize,
  resolveBoxAIImageSize,
} from "@/lib/image-sizes";
import {
  getAllTemplates,
  mutateTemplates,
  saveUploadedImage,
} from "@/lib/template-store";
import type { ExamplePair, StudioTemplate } from "@/lib/template-types";
import { requireSameOrigin } from "@/lib/payment-session";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalImage(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireAdminApiAccess(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "管理员接口未授权" },
      { status: error instanceof AdminAuthorizationError ? error.status : 403 },
    );
  }

  const { id } = await params;
  const templates = await getAllTemplates();
  const templateIndex = templates.findIndex((item) => item.id === id);
  if (templateIndex < 0) return Response.json({ error: "模板不存在" }, { status: 404 });

  const current = templates[templateIndex];
  const formData = await request.formData();
  const name = text(formData, "name");
  const category = text(formData, "category");
  const tagline = text(formData, "tagline");
  const description = text(formData, "description");
  const privatePrompt = text(formData, "privatePrompt");
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

  const exampleIds = formData.getAll("exampleIds").map(String);
  if (!exampleIds.length) {
    return Response.json({ error: "模板至少需要保留一组原图和效果图" }, { status: 400 });
  }
  if (exampleIds.length > 12 || new Set(exampleIds).size !== exampleIds.length) {
    return Response.json({ error: "案例数据无效，一次最多保留 12 组案例" }, { status: 400 });
  }

  const existingExamples = new Map(current.examples.map((example) => [example.id, example]));
  const examples: ExamplePair[] = [];
  try {
    for (let index = 0; index < exampleIds.length; index += 1) {
      const exampleId = exampleIds[index];
      const existing = existingExamples.get(exampleId);
      const inputFile = optionalImage(formData, `exampleInput:${exampleId}`);
      const outputFile = optionalImage(formData, `exampleOutput:${exampleId}`);
      if (!existing && (!exampleId.startsWith("new-") || !inputFile || !outputFile)) {
        return Response.json({ error: `新增案例 ${index + 1} 必须同时上传原图和效果图` }, { status: 400 });
      }
      if (!existing && exampleId.startsWith("new-")) {
        examples.push({
          id: randomUUID(),
          inputImage: await saveUploadedImage(inputFile!, `${current.slug}-before-${index + 1}`),
          outputImage: await saveUploadedImage(outputFile!, `${current.slug}-after-${index + 1}`),
        });
        continue;
      }
      if (!existing) return Response.json({ error: "案例数据无效" }, { status: 400 });
      examples.push({
        id: existing.id,
        inputImage: inputFile
          ? await saveUploadedImage(inputFile, `${current.slug}-before-${index + 1}`)
          : existing.inputImage,
        outputImage: outputFile
          ? await saveUploadedImage(outputFile, `${current.slug}-after-${index + 1}`)
          : existing.outputImage,
      });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "案例图片保存失败" },
      { status: 400 },
    );
  }

  const wantsPublished = text(formData, "submitIntent") !== "draft";
  if (wantsPublished && current.source?.rightsStatus === "reference_only") {
    return Response.json({ error: "仅供参考的素材只能保存为草稿" }, { status: 400 });
  }
  const outputRatio = normalizeBoxAIRatio(text(formData, "outputRatio"));
  const requestedOutputSize = text(formData, "outputSize") || resolveBoxAIHighImageSize(outputRatio);
  const outputSize = displayImageSize(
    resolveBoxAIImageSize(requestedOutputSize, outputRatio),
  );
  const coverFile = optionalImage(formData, "coverImage");

  let coverImage = current.coverImage;
  try {
    if (coverFile) coverImage = await saveUploadedImage(coverFile, `${current.slug}-cover`);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "封面图片保存失败" },
      { status: 400 },
    );
  }

  const updated: StudioTemplate = {
    ...current,
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
    allowedCounts: formData.get("allowCount2") === "on" ? [1, 2] : [1],
    priceCredits: Math.max(1, Number(formData.get("priceCredits") ?? 1)),
    providerId: "boxai",
    model,
    privatePrompt,
    negativePrompt: text(formData, "negativePrompt"),
    status: wantsPublished ? "published" : "draft",
    isFeatured: formData.get("isFeatured") === "on",
    updatedAt: new Date().toISOString(),
  };

  await mutateTemplates((latest) => {
    const latestIndex = latest.findIndex((item) => item.id === id);
    if (latestIndex < 0) throw new Error("模板不存在");
    latest[latestIndex] = updated;
    return { templates: latest, result: updated };
  });
  return Response.json({ id: updated.id, slug: updated.slug, status: updated.status });
}
