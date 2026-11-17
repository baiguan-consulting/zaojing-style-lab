import "server-only";

import sharp from "sharp";

const JPEG_OPTIONS = { quality: 94, chromaSubsampling: "4:4:4" as const };

export type ProcessedComparisonImage = {
  inputImage: Buffer;
  outputImage: Buffer;
  comparisonImage: Buffer;
  splitRatio: number;
};

function assertImageMetadata(width?: number, height?: number) {
  if (!width || !height || width < 400 || height < 600) {
    throw new Error("上下对照图尺寸过小，请上传宽度至少 400px、高度至少 600px 的图片");
  }
  if (width * height > 40_000_000) {
    throw new Error("上下对照图像素过大，请控制在 4000 万像素以内");
  }
}

async function normalizeImage(buffer: Buffer) {
  return sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg(JPEG_OPTIONS)
    .toBuffer();
}

async function detectHorizontalSplit(buffer: Buffer) {
  const resized = await sharp(buffer)
    .resize({ width: 256, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = resized.info;
  const pixels = resized.data;
  const start = Math.floor(height * 0.3);
  const end = Math.floor(height * 0.64);
  let bestRow = Math.floor(height * 0.48);
  let bestScore = -1;

  for (let y = start; y < end - 1; y += 1) {
    let difference = 0;
    let brightness = 0;
    let squaredBrightness = 0;
    for (let x = 0; x < width; x += 1) {
      const current = (y * width + x) * channels;
      const next = ((y + 1) * width + x) * channels;
      const value = (pixels[current] + pixels[current + 1] + pixels[current + 2]) / 3;
      brightness += value;
      squaredBrightness += value * value;
      difference += (
        Math.abs(pixels[current] - pixels[next])
        + Math.abs(pixels[current + 1] - pixels[next + 1])
        + Math.abs(pixels[current + 2] - pixels[next + 2])
      ) / 3;
    }
    const mean = brightness / width;
    const variance = Math.max(0, squaredBrightness / width - mean * mean);
    const uniformBrightLineBonus = mean > 220 ? Math.max(0, 22 - Math.sqrt(variance)) * 0.45 : 0;
    const score = difference / width + uniformBrightLineBonus;
    if (score > bestScore) {
      bestScore = score;
      bestRow = y + 1;
    }
  }
  return bestRow / height;
}

type ArrowDetection = { y: number; leftX: number; rightX: number };

function circleContrast(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  let innerSum = 0;
  let innerSquared = 0;
  let innerCount = 0;
  let ringSum = 0;
  let ringCount = 0;
  const outerRadius = radius * 1.65;
  for (let y = Math.max(0, centerY - Math.ceil(outerRadius)); y <= Math.min(height - 1, centerY + Math.ceil(outerRadius)); y += 1) {
    for (let x = Math.max(0, centerX - Math.ceil(outerRadius)); x <= Math.min(width - 1, centerX + Math.ceil(outerRadius)); x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      const offset = (y * width + x) * channels;
      const value = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (distance <= radius) {
        innerSum += value;
        innerSquared += value * value;
        innerCount += 1;
      } else if (distance <= outerRadius && distance >= radius * 1.2) {
        ringSum += value;
        ringCount += 1;
      }
    }
  }
  if (!innerCount || !ringCount) return 0;
  const innerMean = innerSum / innerCount;
  const ringMean = ringSum / ringCount;
  const deviation = Math.sqrt(Math.max(0, innerSquared / innerCount - innerMean * innerMean));
  return Math.abs(innerMean - ringMean) + deviation * 0.32;
}

async function detectArrowControls(buffer: Buffer): Promise<ArrowDetection> {
  const resized = await sharp(buffer)
    .resize({ width: 256, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = resized.info;
  const radius = Math.max(7, Math.round(width * 0.028));
  const leftX = Math.round(width * 0.045);
  const rightCandidates = [Math.round(width * 0.955), Math.round(width * 0.978)];
  let best = { score: -1, y: Math.round(height * 0.08), rightX: rightCandidates[0] };
  for (let y = Math.round(height * 0.035); y <= Math.round(height * 0.18); y += 1) {
    const leftScore = circleContrast(resized.data, width, height, channels, leftX, y, radius);
    for (const rightX of rightCandidates) {
      const rightScore = circleContrast(resized.data, width, height, channels, rightX, y, radius);
      const score = leftScore + rightScore;
      if (score > best.score) best = { score, y, rightX };
    }
  }
  return {
    y: best.y / height,
    leftX: leftX / width,
    rightX: best.rightX / width,
  };
}

function markCircle(
  mask: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 1) {
      if (Math.hypot(x - centerX, y - centerY) <= radius) mask[y * width + x] = 1;
    }
  }
}

function markCornerBadge(mask: Uint8Array, width: number, height: number) {
  const left = Math.round(width * 0.895);
  const top = Math.round(height * 0.006);
  const bottom = Math.round(height * 0.105);
  const radius = Math.max(12, Math.round((bottom - top) * 0.48));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < width; x += 1) {
      const inMiddle = y >= top + radius && y <= bottom - radius;
      const inBody = x >= left + radius;
      const inTopCorner = Math.hypot(x - (left + radius), y - (top + radius)) <= radius;
      const inBottomCorner = Math.hypot(x - (left + radius), y - (bottom - radius)) <= radius;
      if (inMiddle || inBody || inTopCorner || inBottomCorner) mask[y * width + x] = 1;
    }
  }
}

function diffuseInpaint(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  mask: Uint8Array,
) {
  const maskedPixels: number[] = [];
  const boundarySums = new Array<number>(channels).fill(0);
  let boundaryCount = 0;
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      maskedPixels.push(pixel);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighborPixel = ny * width + nx;
        if (mask[neighborPixel]) continue;
        const offset = neighborPixel * channels;
        for (let channel = 0; channel < channels; channel += 1) boundarySums[channel] += data[offset + channel];
        boundaryCount += 1;
      }
    }
  }

  if (!maskedPixels.length || !boundaryCount) return;
  const values = Float32Array.from(data);
  for (const pixel of maskedPixels) {
    const offset = pixel * channels;
    for (let channel = 0; channel < channels; channel += 1) values[offset + channel] = boundarySums[channel] / boundaryCount;
  }

  for (let iteration = 0; iteration < 140; iteration += 1) {
    for (const pixel of maskedPixels) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const sums = new Array<number>(channels).fill(0);
      let count = 0;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const offset = (ny * width + nx) * channels;
        for (let channel = 0; channel < channels; channel += 1) sums[channel] += values[offset + channel];
        count += 1;
      }
      const offset = pixel * channels;
      for (let channel = 0; channel < channels; channel += 1) values[offset + channel] = sums[channel] / count;
    }
  }

  for (const pixel of maskedPixels) {
    const offset = pixel * channels;
    for (let channel = 0; channel < channels; channel += 1) data[offset + channel] = Math.round(values[offset + channel]);
  }
}

async function cleanScreenshotUi(buffer: Buffer, panel: "input" | "output") {
  const raw = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  const { width, height, channels } = raw.info;
  const mask = new Uint8Array(width * height);

  if (panel === "input") {
    markCornerBadge(mask, width, height);
  } else {
    const controls = await detectArrowControls(buffer);
    const centerY = Math.round(height * controls.y);
    const radius = Math.max(26, Math.round(width * 0.04));
    markCircle(mask, width, height, Math.round(width * controls.leftX), centerY, radius);
    markCircle(mask, width, height, Math.round(width * controls.rightX), centerY, radius);
  }

  diffuseInpaint(data, width, height, channels, mask);

  return sharp(data, { raw: { width, height, channels } }).jpeg(JPEG_OPTIONS).toBuffer();
}

export async function processComparisonImage(
  file: File,
  options: { cleanScreenshotUi: boolean },
): Promise<ProcessedComparisonImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`“${file.name}”不是支持的 JPG、PNG 或 WebP 图片`);
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error(`“${file.name}”超过 20MB`);
  }

  const normalized = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  const metadata = await sharp(normalized).metadata();
  assertImageMetadata(metadata.width, metadata.height);
  const width = metadata.width!;
  const height = metadata.height!;
  const splitRatio = await detectHorizontalSplit(normalized);
  const splitY = Math.round(height * splitRatio);
  const dividerMargin = Math.max(2, Math.round(height * 0.0025));
  const inputHeight = Math.max(1, splitY - dividerMargin);
  const outputTop = Math.min(height - 1, splitY + dividerMargin);
  const footerTrim = options.cleanScreenshotUi ? Math.max(0, Math.round(height * 0.01)) : 0;
  const outputHeight = height - outputTop - footerTrim;
  if (inputHeight < height * 0.24 || outputHeight < height * 0.24) {
    throw new Error(`无法可靠识别“${file.name}”的上下分割线，请确认图片是上下对照图`);
  }

  let inputImage = await sharp(normalized)
    .extract({ left: 0, top: 0, width, height: inputHeight })
    .jpeg(JPEG_OPTIONS)
    .toBuffer();
  let outputImage = await sharp(normalized)
    .extract({ left: 0, top: outputTop, width, height: outputHeight })
    .jpeg(JPEG_OPTIONS)
    .toBuffer();

  if (options.cleanScreenshotUi) {
    inputImage = await cleanScreenshotUi(inputImage, "input");
    outputImage = await cleanScreenshotUi(outputImage, "output");
  }

  const separator = Math.max(6, Math.round(width * 0.006));
  const comparisonHeight = inputHeight + separator + outputHeight;
  const comparisonImage = await sharp({
    create: {
      width,
      height: comparisonHeight,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([
      { input: inputImage, left: 0, top: 0 },
      { input: outputImage, left: 0, top: inputHeight + separator },
    ])
    .jpeg(JPEG_OPTIONS)
    .toBuffer();

  return { inputImage, outputImage, comparisonImage, splitRatio };
}
