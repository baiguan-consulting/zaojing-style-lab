export type BoxAISizePreset = {
  value: string;
  label: string;
  tier: "标准" | "高清" | "超清";
};

export const BOXAI_SIZE_PRESETS: Record<string, BoxAISizePreset[]> = {
  "3:1": [
    { value: "1536x512", label: "1536 × 512", tier: "标准" },
    { value: "3072x1024", label: "3072 × 1024", tier: "高清" },
    { value: "3840x1280", label: "3840 × 1280", tier: "超清" },
  ],
  "7:3": [
    { value: "1344x576", label: "1344 × 576", tier: "标准" },
    { value: "2688x1152", label: "2688 × 1152", tier: "高清" },
    { value: "3840x1648", label: "3840 × 1648", tier: "超清" },
  ],
  "1:1": [
    { value: "1024x1024", label: "1024 × 1024", tier: "标准" },
    { value: "2048x2048", label: "2048 × 2048", tier: "高清" },
    { value: "2880x2880", label: "2880 × 2880", tier: "超清" },
  ],
  "3:4": [
    { value: "768x1024", label: "768 × 1024", tier: "标准" },
    { value: "1536x2048", label: "1536 × 2048", tier: "高清" },
    { value: "2480x3312", label: "2480 × 3312", tier: "超清" },
  ],
  "4:3": [
    { value: "1024x768", label: "1024 × 768", tier: "标准" },
    { value: "2048x1536", label: "2048 × 1536", tier: "高清" },
    { value: "3312x2480", label: "3312 × 2480", tier: "超清" },
  ],
  "2:3": [
    { value: "768x1152", label: "768 × 1152", tier: "标准" },
    { value: "1536x2304", label: "1536 × 2304", tier: "高清" },
    { value: "2352x3520", label: "2352 × 3520", tier: "超清" },
  ],
  "3:2": [
    { value: "1152x768", label: "1152 × 768", tier: "标准" },
    { value: "2304x1536", label: "2304 × 1536", tier: "高清" },
    { value: "3520x2352", label: "3520 × 2352", tier: "超清" },
  ],
  "9:16": [
    { value: "720x1280", label: "720 × 1280", tier: "标准" },
    { value: "1152x2048", label: "1152 × 2048", tier: "高清" },
    { value: "2160x3840", label: "2160 × 3840", tier: "超清" },
  ],
  "16:9": [
    { value: "1280x720", label: "1280 × 720", tier: "标准" },
    { value: "2048x1152", label: "2048 × 1152", tier: "高清" },
    { value: "3840x2160", label: "3840 × 2160", tier: "超清" },
  ],
  "1:3": [
    { value: "512x1536", label: "512 × 1536", tier: "标准" },
    { value: "1024x3072", label: "1024 × 3072", tier: "高清" },
    { value: "1280x3840", label: "1280 × 3840", tier: "超清" },
  ],
};

export const BOXAI_RATIOS = Object.keys(BOXAI_SIZE_PRESETS);

export function normalizeSizeValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace("×", "x");
}

export function normalizeBoxAIRatio(value: string) {
  return BOXAI_SIZE_PRESETS[value] ? value : "3:4";
}

export function resolveBoxAIStandardImageSize(requestedRatio: string) {
  const ratio = normalizeBoxAIRatio(requestedRatio);
  return BOXAI_SIZE_PRESETS[ratio][0].value;
}

export function resolveBoxAIHighImageSize(requestedRatio: string) {
  const ratio = normalizeBoxAIRatio(requestedRatio);
  return (BOXAI_SIZE_PRESETS[ratio][1] ?? BOXAI_SIZE_PRESETS[ratio][0]).value;
}

export function resolveBoxAIImageSize(requestedSize: string, requestedRatio: string) {
  const ratio = normalizeBoxAIRatio(requestedRatio);
  const presets = BOXAI_SIZE_PRESETS[ratio];
  const normalized = normalizeSizeValue(requestedSize);
  const exact = presets.find((preset) => preset.value === normalized);
  return exact?.value ?? resolveBoxAIStandardImageSize(ratio);
}

export function displayImageSize(value: string) {
  return normalizeSizeValue(value).replace("x", " × ");
}
