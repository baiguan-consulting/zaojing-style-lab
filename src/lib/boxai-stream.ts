export type BoxAIImageItem = {
  b64_json?: string;
  url?: string;
};

export type BoxAIImageResponse = {
  data?: BoxAIImageItem[] | BoxAIImageItem;
  error?: { message?: string } | string;
  message?: string;
};

function providerError(payload: BoxAIImageResponse) {
  if (typeof payload.error === "string") return payload.error;
  return payload.error?.message || payload.message;
}

function imageItems(payload: BoxAIImageResponse) {
  if (!payload.data) return [];
  return Array.isArray(payload.data) ? payload.data : [payload.data];
}

function imageKey(item: BoxAIImageItem) {
  if (item.url) return `url:${item.url}`;
  if (item.b64_json) return `b64:${item.b64_json.length}:${item.b64_json.slice(0, 64)}`;
  return "";
}

export async function readBoxAIImageResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("text/event-stream")) {
    const payload = (await response.json()) as BoxAIImageResponse;
    const error = providerError(payload);
    if (error) throw new Error(error);
    return imageItems(payload);
  }

  if (!response.body) throw new Error("BoxAI 流式响应没有内容");

  const images: BoxAIImageItem[] = [];
  const seen = new Set<string>();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  function add(item: BoxAIImageItem) {
    const key = imageKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    images.push(item);
  }

  function consumeEvent(block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return;

    const payload = JSON.parse(data) as BoxAIImageResponse & {
      type?: string;
      b64_json?: string;
      url?: string;
    };
    const error = providerError(payload);
    if (error) throw new Error(error);

    for (const item of imageItems(payload)) add(item);
    if (!payload.type?.includes("partial_image")) {
      add({ b64_json: payload.b64_json, url: payload.url });
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) consumeEvent(block);
    if (done) break;
  }
  if (buffer.trim()) consumeEvent(buffer);
  return images;
}
