import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { processComparisonImage } from "../src/lib/comparison-image-processor";
import { buildLockedPrompt } from "../src/lib/generation";
import {
  organizeTemplateWithAI,
  parseTemplateAIResponse,
  type TemplateAIModel,
} from "../src/lib/template-ai";
import {
  deriveImportFields,
  normalizeNegativePrompt,
  normalizeStyleOnlyPrompt,
} from "../src/lib/template-import-rules";
import { makeSlug, normalizeTemplateRouteSlug } from "../src/lib/template-store";
import type { StudioTemplate } from "../src/lib/template-types";


test("comparison prompt becomes a locked style-only prompt", () => {
  const source = `# 一颗颗小豆子 拼出世界著名建筑
**整体构图：** 画面上下分为两个部分，各占50%。
**上半部分：** 展示该建筑的真实摄影作品。
**下半部分：** 将同一建筑转化为立体拼豆艺术模型，呈现圆形轮廓和中心圆孔。`;
  const fields = deriveImportFields(source);

  assert.equal(fields.name, "一颗颗小豆子 拼出世界著名建筑");
  assert.match(fields.prompt, /最终图片只呈现风格化后的成品/);
  assert.match(fields.prompt, /立体拼豆艺术模型/);
  assert.doesNotMatch(fields.prompt, /展示该建筑的真实摄影作品/);
  assert.equal(fields.ratio, "3:4");
});

test("style-only normalization is idempotent and negative rules are deduplicated", () => {
  const normalized = normalizeStyleOnlyPrompt("使用柔和纸张质感完成作品。");
  assert.equal(normalizeStyleOnlyPrompt(normalized), normalized);
  const negative = normalizeNegativePrompt("水印，结构错误，水印");
  assert.equal(negative.split("，").filter((item) => item === "水印").length, 1);
  assert.match(negative, /上下分屏/);
});

test("template AI parser accepts fenced JSON and applies prompt guardrails", () => {
  const draft = parseTemplateAIResponse(`\`\`\`json
{
  "name": "纸雕森林",
  "nameEn": "Paper Forest",
  "tagline": "把日常场景变成纸雕舞台",
  "description": "使用层叠纸张和柔和侧光完成场景。",
  "category": "艺术插画",
  "tags": ["纸雕", "手工质感"],
  "ratio": "4:3",
  "allowText": true,
  "allowImage": false,
  "privatePrompt": "使用层叠纸张、清晰景深和柔和侧光创作完整画面。",
  "negativePrompt": "塑料质感，水印",
  "warnings": []
}
\`\`\``, "# 纸雕森林\n提示词：生成纸雕风格的森林场景。");

  assert.equal(draft.name, "纸雕森林");
  assert.equal(draft.nameEn, "Paper Forest");
  assert.equal(draft.ratio, "4:3");
  assert.equal(draft.allowImage, false);
  assert.match(draft.privatePrompt, /只生成风格图/);
  assert.match(draft.negativePrompt, /上下分屏/);
  assert.match(draft.negativePrompt, /塑料质感/);
});

test("template AI parser rejects malformed model output", () => {
  assert.throws(
    () => parseTemplateAIResponse("not-json", "这是一段足够长的模板来源说明和视觉风格提示词。"),
    /JSON|invalid_response|position/i,
  );
});

test("template AI organizer fails over in the configured model order", async () => {
  const called: TemplateAIModel[] = [];
  const result = await organizeTemplateWithAI(
    "# 玻璃花园\n提示词：把用户主体变成通透的彩色玻璃艺术。",
    async (model) => {
      called.push(model);
      if (model !== "gpt-6-luna") throw new Error("temporary upstream failure");
      return JSON.stringify({
        name: "通透玻璃花园",
        tagline: "把主体重构为通透玻璃艺术",
        description: "保留主体结构，以彩色玻璃、折射高光和干净背景完成作品。",
        category: "艺术插画",
        tags: ["玻璃", "折射"],
        ratio: "3:4",
        allowText: true,
        allowImage: true,
        privatePrompt: "生成一张完整的彩色玻璃艺术作品，使用折射高光与透明材质。",
        negativePrompt: "浑浊玻璃",
      });
    },
  );

  assert.deepEqual(called, ["deepseek-v4.1-flash", "gemini-3.8-flash", "gpt-6-luna"]);
  assert.equal(result.model, "gpt-6-luna");
  assert.deepEqual(result.attempts.map((attempt) => attempt.status), ["failed", "failed", "succeeded"]);
  assert.match(result.draft.privatePrompt, /最终图片只呈现风格化后的成品/);
});

test("locked generation prompt delivers the template negative constraints", () => {
  const now = new Date().toISOString();
  const template: StudioTemplate = {
    id: "tpl-test",
    slug: "test",
    name: "测试模板",
    tagline: "测试",
    description: "测试",
    category: "测试",
    tags: [],
    coverImage: "/test.webp",
    examples: [],
    allowText: true,
    allowImage: true,
    textPlaceholder: "描述主体",
    outputRatio: "1:1",
    outputSize: "1024 × 1024",
    allowedCounts: [1],
    priceCredits: 1,
    providerId: "boxai",
    model: "gpt-image-2.5-flare",
    privatePrompt: "只生成一张完整的纸雕作品。",
    negativePrompt: "禁止水印，禁止上下分屏",
    status: "draft",
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  };
  const prompt = buildLockedPrompt(template, "一只橘猫");

  assert.match(prompt, /【禁止出现｜与模板核心指令同等优先】/);
  assert.match(prompt, /禁止水印，禁止上下分屏/);
  assert.ok(prompt.indexOf("禁止水印") < prompt.indexOf("一只橘猫"));
});

test("template route slugs are URL-safe and encoded legacy slugs still resolve", () => {
  assert.equal(makeSlug("Travel Stamp", 1234), "travel-stamp");
  assert.equal(makeSlug("万物变点云线框｜附AI提示词", 1234), "style-ai-ya");
  assert.equal(
    normalizeTemplateRouteSlug("%E4%B8%87%E7%89%A9%E5%8F%98%E7%82%B9%E4%BA%91"),
    "万物变点云",
  );
});

test("daily slice prompt keeps style layout but removes the photographic comparison", () => {
  const source = `# 日常变切层雕塑
上下画面均由AI生成。封面实际输入：生成一张艺术对照海报，上部约42%为AI拟真摄影，下部约58%为风格重构。原创场景：一座白色海边楼梯。下部风格：把主体重建为密集等距竖直薄片雕塑。排版设计：雕塑偏右，左上排标题。仅写英文短标题“LINES OF SUMMER”，上部左下小字“AI PHOTO”，下部合适角落小字“薄片切层雕塑”。`;
  const prompt = deriveImportFields(source).prompt;
  assert.match(prompt, /密集等距竖直薄片雕塑/);
  assert.match(prompt, /左上排标题/);
  assert.match(prompt, /LINES OF SUMMER/);
  assert.doesNotMatch(prompt, /AI拟真摄影/);
  assert.doesNotMatch(prompt, /AI PHOTO/);
  assert.doesNotMatch(prompt, /白色海边楼梯/);
});

test("a horizontal comparison image is split and recomposed", async () => {
  const width = 800;
  const topHeight = 600;
  const divider = 12;
  const bottomHeight = 700;
  const source = await sharp({
    create: {
      width,
      height: topHeight + divider + bottomHeight,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([
      {
        input: await sharp({ create: { width, height: topHeight, channels: 3, background: "#c94432" } }).png().toBuffer(),
        left: 0,
        top: 0,
      },
      {
        input: await sharp({ create: { width, height: bottomHeight, channels: 3, background: "#315da8" } }).png().toBuffer(),
        left: 0,
        top: topHeight + divider,
      },
    ])
    .png()
    .toBuffer();
  const file = new File([source], "comparison.png", { type: "image/png" });
  const result = await processComparisonImage(file, { cleanScreenshotUi: false });
  const inputStats = await sharp(result.inputImage).stats();
  const outputStats = await sharp(result.outputImage).stats();
  const comparisonMetadata = await sharp(result.comparisonImage).metadata();

  assert.ok(result.splitRatio > 0.4 && result.splitRatio < 0.55);
  assert.ok(inputStats.channels[0].mean > inputStats.channels[2].mean);
  assert.ok(outputStats.channels[2].mean > outputStats.channels[0].mean);
  assert.equal(comparisonMetadata.width, width);
  assert.ok((comparisonMetadata.height ?? 0) > 1200);
});
