import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  readBoxAIImageResponse,
  type BoxAIImageItem,
  type BoxAIImageResponse,
} from "./boxai-stream";
import { resolveBoxAIImageSize } from "./image-sizes";
import { saveGeneratedImage } from "./template-store";

export const BOXAI_MODELS = [
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const;

export const BOXAI_TEMPLATE_TEXT_MODELS = [
  "deepseek-v4.1-flash",
  "gemini-3.8-flash",
  "gpt-6-luna",
] as const;

const RETRYABLE_CONNECT_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "UND_ERR_CONNECT_TIMEOUT",
]);

// BoxAI's own image client uses this header to keep long, non-streaming requests alive.
const BOXAI_IMAGE_HEADERS = { "X-BoxAI-Keepalive": "1" } as const;

export type BoxAIGenerationRequest = {
  clientRequestId?: string;
  model: string;
  prompt: string;
  inputImagePath?: string;
  count: number;
  outputRatio: string;
  outputSize: string;
};

export function getBoxAIConfig() {
  const apiKey = process.env.BOXAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("BoxAI API Key 尚未配置，请在项目 .env.local 中填写 BOXAI_API_KEY");
  }

  return {
    apiKey,
    baseUrl: (process.env.BOXAI_BASE_URL?.trim() || "https://you-box.com/v1").replace(/\/$/, ""),
  };
}

function modelFor(value: string) {
  if ((BOXAI_MODELS as readonly string[]).includes(value)) return value;
  throw new Error(`BoxAI 模型配置无效：${value || "未填写"}`);
}

function mimeTypeFor(filename: string) {
  switch (path.extname(filename).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

async function readError(response: Response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as BoxAIImageResponse;
    if (typeof parsed.error === "string") return parsed.error;
    return parsed.error?.message || parsed.message || raw;
  } catch {
    return raw;
  }
}

function networkErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const direct = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const cause = "cause" in error && error.cause && typeof error.cause === "object"
    && "code" in error.cause && typeof error.cause.code === "string"
    ? error.cause.code
    : undefined;
  return cause || direct;
}

function friendlyNetworkError(error: unknown, stage: string) {
  const code = networkErrorCode(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new Error(`${stage}超时，请稍后重试。本次不会扣除创作次数`);
  }
  return new Error(`${stage}网络异常${code ? `（${code}）` : ""}，请稍后重试。本次不会扣除创作次数`);
}

function requestIdFor(response: Response) {
  return response.headers.get("x-oneapi-request-id")
    || response.headers.get("x-request-id")
    || response.headers.get("request-id")
    || undefined;
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestBoxAI(
  send: () => Promise<Response>,
  stage: string,
  context: Record<string, string | number | undefined>,
  retryConnectFailure = false,
) {
  const startedAt = Date.now();
  console.info("[boxai] request started", context);
  try {
    const response = await send();
    console.info("[boxai] response headers received", {
      ...context,
      status: response.status,
      durationMs: Date.now() - startedAt,
      providerRequestId: requestIdFor(response),
      contentType: response.headers.get("content-type") || undefined,
      contentLength: response.headers.get("content-length") || undefined,
    });
    return response;
  } catch (error) {
    const code = networkErrorCode(error);
    if (retryConnectFailure && code && RETRYABLE_CONNECT_CODES.has(code)) {
      await wait(1200);
      try {
        const response = await send();
        console.info("[boxai] retry response headers received", {
          ...context,
          status: response.status,
          durationMs: Date.now() - startedAt,
          providerRequestId: requestIdFor(response),
          contentType: response.headers.get("content-type") || undefined,
          contentLength: response.headers.get("content-length") || undefined,
        });
        return response;
      } catch (retriedError) {
        console.error("[boxai] request failed after safe connection retry", {
          ...context,
          durationMs: Date.now() - startedAt,
          code: networkErrorCode(retriedError),
        });
        throw friendlyNetworkError(retriedError, stage);
      }
    }
    console.error("[boxai] request failed", {
      ...context,
      durationMs: Date.now() - startedAt,
      code,
    });
    throw friendlyNetworkError(error, stage);
  }
}

async function downloadGeneratedImage(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (response.ok) return response;
      if (response.status < 500 || attempt === 2) {
        throw new Error(`HTTP_${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
    await wait(800 * (attempt + 1));
  }
  throw friendlyNetworkError(lastError, "BoxAI 生成结果下载");
}

async function persistResults(items: BoxAIImageItem[]) {
  const images: string[] = [];
  for (const item of items) {
    if (item.b64_json) {
      images.push(await saveGeneratedImage(Buffer.from(item.b64_json, "base64"), "image/png"));
      continue;
    }
    if (item.url) {
      const response = await downloadGeneratedImage(item.url);
      const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
      images.push(await saveGeneratedImage(Buffer.from(await response.arrayBuffer()), contentType));
    }
  }
  return images;
}

export async function generateWithBoxAI(request: BoxAIGenerationRequest) {
  const { apiKey, baseUrl } = getBoxAIConfig();
  const model = modelFor(request.model);
  const size = resolveBoxAIImageSize(request.outputSize, request.outputRatio);
  const logContext = {
    clientRequestId: request.clientRequestId,
    model,
    size,
    count: request.count,
    operation: request.inputImagePath ? "images.edits" : "images.generations",
  };
  let response: Response;

  if (request.inputImagePath) {
    const inputImagePath = request.inputImagePath;
    const imageBuffer = await readFile(inputImagePath);
    response = await requestBoxAI(() => {
      const formData = new FormData();
      formData.set("model", model);
      formData.set("prompt", request.prompt);
      formData.set("n", String(request.count));
      formData.set("size", size);
      formData.set(
        "image",
        new Blob([imageBuffer], { type: mimeTypeFor(inputImagePath) }),
        path.basename(inputImagePath),
      );
      return fetch(`${baseUrl}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...BOXAI_IMAGE_HEADERS,
        },
        body: formData,
        signal: AbortSignal.timeout(180_000),
      });
    }, "BoxAI 生图请求", logContext, true);
  } else {
    const body = JSON.stringify({
      model,
      prompt: request.prompt,
      n: request.count,
      size,
    });
    response = await requestBoxAI(() => fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...BOXAI_IMAGE_HEADERS,
      },
      body,
      signal: AbortSignal.timeout(180_000),
    }), "BoxAI 生图请求", logContext, true);
  }

  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(`BoxAI 请求失败（${response.status}）：${detail || "未知错误"}`);
  }

  const requestId = requestIdFor(response);
  try {
    const items = await readBoxAIImageResponse(response);
    const images = await persistResults(items);
    if (!images.length) throw new Error("BoxAI 请求成功，但响应中没有可用图片");
    return images;
  } catch (error) {
    const code = networkErrorCode(error);
    const message = code || (error instanceof Error && error.message === "terminated")
      ? friendlyNetworkError(error, "BoxAI 生成结果接收").message
      : error instanceof Error ? error.message : "BoxAI 生成结果读取失败";
    const suffix = requestId ? `（BoxAI 请求 ID：${requestId}）` : "";
    console.error("[boxai] response body or generated image failed", {
      ...logContext,
      providerRequestId: requestId,
      code,
      message,
    });
    throw new Error(`${message}${suffix}`);
  }
}

export function getBoxAIStatus() {
  return {
    configured: Boolean(process.env.BOXAI_API_KEY?.trim()),
    baseUrl: process.env.BOXAI_BASE_URL?.trim() || "https://you-box.com/v1",
    models: [...BOXAI_MODELS],
    templateTextModels: [...BOXAI_TEMPLATE_TEXT_MODELS],
  };
}

export async function testBoxAIConnection() {
  const { apiKey, baseUrl } = getBoxAIConfig();
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(`BoxAI 连接失败（${response.status}）：${detail || "请检查密钥和账户权限"}`);
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  const modelIds = (payload.data || []).map((item) => item.id).filter(Boolean) as string[];
  return {
    ok: true,
    availableModels: BOXAI_MODELS.filter((model) => modelIds.includes(model)),
    availableTemplateTextModels: BOXAI_TEMPLATE_TEXT_MODELS.filter((model) => modelIds.includes(model)),
    modelCount: modelIds.length,
  };
}
