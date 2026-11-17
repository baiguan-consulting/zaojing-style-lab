import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { seedTemplates } from "../src/lib/seed-templates";
import { localizeTemplate } from "../src/lib/template-localization";
import { toPublicTemplate, type StudioTemplate } from "../src/lib/template-types";

const placeholderId = /^tpl-demo-[1-7]$/;

test("template initialization does not recreate placeholder demos", () => {
  assert.equal(seedTemplates.some((template) => placeholderId.test(template.id)), false);
  assert.deepEqual(seedTemplates.map((template) => template.id), ["tpl-vintage-stamp"]);
});

test("current local catalog does not publish placeholder demos", async () => {
  const raw = await readFile(new URL("../data/templates.json", import.meta.url), "utf8");
  const templates = JSON.parse(raw) as StudioTemplate[];

  assert.equal(templates.some((template) => placeholderId.test(template.id)), false);
  assert.equal(templates.every((template) => !template.description.includes("演示模板")), true);
});

test("featured stamp has a standalone result image", () => {
  const stamp = seedTemplates.find((template) => template.id === "tpl-vintage-stamp");
  assert.ok(stamp);
  assert.ok(stamp.examples[0]?.outputImage);
  assert.notEqual(stamp.examples[0].outputImage, stamp.coverImage);
});

test("English catalog copy localizes existing templates and respects saved translations", () => {
  const stamp = seedTemplates.find((template) => template.id === "tpl-vintage-stamp");
  assert.ok(stamp);
  const localized = localizeTemplate(toPublicTemplate(stamp), "en");
  assert.equal(localized.name, "Vintage Travel Stamp");
  assert.equal(localized.category, "Travel Art");
  assert.match(localized.textPlaceholder, /boat/i);

  const saved = localizeTemplate(toPublicTemplate({
    ...stamp,
    translations: { en: { name: "Saved English Name" } },
  }), "en");
  assert.equal(saved.name, "Saved English Name");
  assert.equal(saved.tagline, "Keep a travel memory inside a handmade stamp");
});
