import assert from "node:assert/strict";
import test from "node:test";

import { readBoxAIImageResponse } from "../src/lib/boxai-stream";

test("reads a regular BoxAI image response", async () => {
  const response = new Response(JSON.stringify({ data: [{ url: "https://example.com/final.png" }] }), {
    headers: { "content-type": "application/json" },
  });
  assert.deepEqual(await readBoxAIImageResponse(response), [{ url: "https://example.com/final.png" }]);
});

test("keeps only completed images from a BoxAI SSE response", async () => {
  const body = [
    "event: image_generation.partial_image",
    'data: {"type":"image_generation.partial_image","partial_image_index":0,"b64_json":"preview"}',
    "",
    "event: image_generation.completed",
    'data: {"type":"image_generation.completed","b64_json":"final"}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const response = new Response(body, { headers: { "content-type": "text/event-stream" } });
  assert.deepEqual(await readBoxAIImageResponse(response), [{ b64_json: "final", url: undefined }]);
});

test("reads data arrays wrapped in BoxAI SSE", async () => {
  const body = 'data: {"data":[{"url":"https://example.com/final.png"}]}\n\ndata: [DONE]\n\n';
  const response = new Response(body, { headers: { "content-type": "text/event-stream" } });
  assert.deepEqual(await readBoxAIImageResponse(response), [{ url: "https://example.com/final.png" }]);
});
