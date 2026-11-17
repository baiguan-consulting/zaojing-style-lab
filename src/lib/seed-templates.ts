import type { StudioTemplate } from "./template-types";

const now = "2026-11-04T09:00:00.000Z";

const stampPrompt = `根据用户上传的照片，创作一张单张独立的高端复古旅行邮票插画。最终图片只呈现完成后的邮票艺术作品，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。准确保留原始照片中最具辨识度的主体、场景、构图关系和主要色彩，将整个场景重新设计为收藏级手工旅行邮票，放置在暖象牙白纸张背景上，四周保留充足留白。使用彩色铅笔、蜡笔笔触、丙烯色块、纸张颗粒和丝网印刷的不完美效果。整体温暖、怀旧、优雅、克制。用户补充文字仅用于描述主体和场景，不得改变上述风格与构图要求。`;

export const seedTemplates: StudioTemplate[] = [
  {
    id: "tpl-vintage-stamp",
    slug: "vintage-travel-stamp",
    name: "复古旅行邮票",
    tagline: "把一段旅行记忆，收进手工邮票里",
    description:
      "从照片中提取最有辨识度的主体与颜色，转化为带有纸张颗粒、彩铅笔触和旧式印刷瑕疵的收藏级旅行邮票。",
    category: "旅行艺术",
    tags: ["复古", "邮票", "旅行", "手绘"],
    coverImage: "/demo/stamp-lake-comparison.webp",
    examples: [
      {
        id: "stamp-lake",
        inputImage: "/demo/stamp-lake-input.webp",
        outputImage: "/demo/stamp-lake-output.webp",
      },
      {
        id: "stamp-autumn",
        inputImage: "/demo/stamp-autumn-input.webp",
        outputImage: "/demo/stamp-autumn-output.webp",
      },
      {
        id: "stamp-snow",
        inputImage: "/demo/stamp-snow-input.webp",
        outputImage: "/demo/stamp-snow-output.webp",
      },
    ],
    allowText: true,
    allowImage: true,
    textPlaceholder: "例如：保留湖面上的小船，整体更安静、柔和",
    outputRatio: "3:4",
    outputSize: "1536 × 2048",
    allowedCounts: [1, 2],
    priceCredits: 1,
    providerId: "boxai",
    model: "gpt-image-2.5-flare",
    privatePrompt: stampPrompt,
    negativePrompt:
      "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，现代商业海报，大型标题，品牌标志，水印，光滑矢量图，3D 渲染，过度饱和",
    status: "published",
    isFeatured: true,
    createdAt: now,
    updatedAt: now,
  },
];
