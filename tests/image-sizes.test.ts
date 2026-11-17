import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBoxAIImageSize,
  resolveBoxAIHighImageSize,
  resolveBoxAIStandardImageSize,
} from "../src/lib/image-sizes";

test("uses BoxAI standard size when no explicit size is provided", () => {
  assert.equal(resolveBoxAIImageSize("", "3:4"), "768x1024");
  assert.equal(resolveBoxAIImageSize("unsupported", "4:3"), "1024x768");
});

test("keeps an explicitly selected supported size", () => {
  assert.equal(resolveBoxAIImageSize("1536 × 2048", "3:4"), "1536x2048");
});

test("resolves the standard size for every supported ratio", () => {
  assert.equal(resolveBoxAIStandardImageSize("1:1"), "1024x1024");
  assert.equal(resolveBoxAIStandardImageSize("9:16"), "720x1280");
});

test("resolves the high-resolution size for every supported ratio", () => {
  assert.equal(resolveBoxAIHighImageSize("3:4"), "1536x2048");
  assert.equal(resolveBoxAIHighImageSize("2:3"), "1536x2304");
  assert.equal(resolveBoxAIHighImageSize("16:9"), "2048x1152");
});
