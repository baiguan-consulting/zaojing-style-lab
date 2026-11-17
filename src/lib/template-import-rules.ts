import { BOXAI_RATIOS } from "./image-sizes";

const SUPPORTED_RATIOS = new Set<string>(BOXAI_RATIOS);

export const COMPARISON_NEGATIVE_PROMPT = [
  "原始照片与风格图同时出现",
  "上下分屏",
  "左右分屏",
  "双联画",
  "前后对比",
  "Before After",
  "拼接图",
  "合集",
  "九宫格",
  "轮播箭头",
  "页码角标",
  "分页圆点",
  "截图界面",
  "水印",
  "品牌标志",
  "账号名称",
  "低清晰度",
  "结构错误",
].join("，");

function decodeCommonEntities(value: string) {
  return value
    .replace(/&#x20;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function cleanSourceText(value: string) {
  return decodeCommonEntities(value)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(?:复制后打开小红书|打开小红书查看|小红书号[:：]?\s*\S+)/gi, "")
    .replace(/(?:点赞|收藏|关注|评论区|求提示词).{0,16}$/gim, "")
    .replace(/\\([*#_`])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(value: string) {
  return value
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^[-—·【[]+|[】\]]+$/g, "")
    .replace(/\*+/g, "")
    .trim();
}

function styleOnlyBody(value: string) {
  let result = cleanSourceText(value);

  // Remove Markdown sections that only describe the comparison layout or source-photo panel.
  result = result
    .replace(/\*\*\s*整体构图\s*[:：]?\s*\*\*[\s\S]*?(?=\*\*[^*]+\*\*|$)/gi, "")
    .replace(/\*\*\s*上半部分\s*[:：]?\s*\*\*[\s\S]*?(?=\*\*[^*]+\*\*|$)/gi, "")
    .replace(/\*\*\s*下半部分\s*[:：]?\s*\*\*/gi, "【最终风格与主体】")
    .replace(/\*\*\s*下部风格\s*[:：]?\s*\*\*/gi, "【最终风格】")
    .replace(/上部左下[^，。；]*[，。；]?/g, "")
    .replace(/上下建筑必须是同一个主题[，,]?/g, "生成建筑必须与用户指定主题一致，");

  const sentences = result
    .split(/(?<=[。！？；])|\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^(?:封面实际输入|原创场景)[:：]/.test(item))
    .filter((item) => !/(?:画面|构图).{0,16}(?:上下分为|上下各|分为上下|上部约|下部约|各占\s*50%)/.test(item))
    .filter((item) => !/^(?:上半部分|上部)[:：]/.test(item))
    .filter((item) => !/(?:上下画面|两部分).{0,24}(?:对应|同一|生成)/.test(item));

  result = sentences
    .join("\n")
    .replace(/(?:下半部分|下部风格)\s*[:：]?/g, "最终风格：")
    .replace(/(?:上半|下半|上部|下部)(?:画面|区域|部分)/g, "最终画面")
    .replace(/上下(?:画面|建筑|主体)/g, "最终主体")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result || "严格提取参考案例中的材质、造型、配色、光影与版式语言，并应用到用户提供的新主体。";
}

export function normalizeStyleOnlyPrompt(value: string) {
  if (value.includes("【平台自动整理｜只生成风格图】")) return value.trim();
  const body = styleOnlyBody(value);
  return [
    "【平台自动整理｜只生成风格图】",
    "根据用户上传的参考图或文字描述，创作一张单张独立的完整作品。最终图片只呈现风格化后的成品，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏，不生成双联画、Before/After、拼接图、合集或截图界面。",
    "【风格、材质与版式规则】",
    body,
    "【执行转换】",
    "原提示词中的原图、实景摄影、上半部分或上部内容只用于识别需要保留的主体、身份、姿态、结构、视角和场景关系，不得出现在最终图片中。原提示词中的效果图、下半部分或下部风格要求应扩展到整张画布，形成一张完整且独立的风格作品。用户补充内容只用于确定主体、场景和希望保留的细节，不得覆盖上述固定风格与独立成图规则。",
  ].join("\n\n");
}

export function normalizeNegativePrompt(value: string) {
  const custom = value.trim();
  if (!custom) return COMPARISON_NEGATIVE_PROMPT;
  const parts = `${COMPARISON_NEGATIVE_PROMPT}，${custom}`
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join("，");
}

export function deriveImportFields(value: string) {
  const cleaned = cleanSourceText(value);
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tags = Array.from(cleaned.matchAll(/#([^#\s，。！？]{1,16})/g), (match) => match[1]).slice(0, 8);
  const ratioMatch = cleaned.match(/(?:比例|画幅|尺寸)?\s*(1:1|2:3|3:4|4:3|9:16|16:9)/i)?.[1];
  const markerIndex = lines.findIndex((line) => /^(?:提示词|prompt|指令)\s*[:：]?/i.test(cleanTitle(line)));
  const rawPrompt = markerIndex >= 0
    ? [
        lines[markerIndex].replace(/^(?:提示词|prompt|指令)\s*[:：]?\s*/i, ""),
        ...lines.slice(markerIndex + 1),
      ].filter(Boolean).join("\n")
    : cleaned.replace(/#[^#\s，。！？]{1,16}/g, "").trim();
  const firstLine = lines.find((line) => !/^(?:提示词|prompt|指令)\s*[:：]?/i.test(cleanTitle(line))) ?? "新风格模板";
  const name = cleanTitle(firstLine).slice(0, 28) || "新风格模板";
  const category = /建筑|地标|城市/.test(cleaned)
    ? "建筑艺术"
    : /人像|肖像|写真|女孩|男孩|人物/.test(cleaned)
      ? "人像写真"
      : /产品|电商|商品|包装/.test(cleaned)
        ? "产品电商"
        : /宠物|猫|狗|动物/.test(cleaned)
          ? "宠物创作"
          : /海报|排版|杂志|封面/.test(cleaned)
            ? "创意设计"
            : "艺术插画";

  return {
    name,
    tagline: `一键生成「${name}」风格的独立作品`,
    description: `保留参考素材中最有辨识度的主体与构图关系，按照“${name}”的固定材质、配色和视觉语言完成整幅风格化创作。`,
    category,
    tags: tags.join(", "),
    ratio: ratioMatch && SUPPORTED_RATIOS.has(ratioMatch) ? ratioMatch : "3:4",
    prompt: normalizeStyleOnlyPrompt(rawPrompt),
    negativePrompt: COMPARISON_NEGATIVE_PROMPT,
  };
}
