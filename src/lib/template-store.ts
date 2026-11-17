import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { seedTemplates } from "./seed-templates";
import {
  toPublicTemplate,
  type PublicTemplate,
  type StudioTemplate,
} from "./template-types";

const dataDirectory = path.join(process.cwd(), "data");
const templatesFile = path.join(dataDirectory, "templates.json");
const uploadsDirectory = path.join(process.cwd(), "public", "uploads");
const temporaryUploadsDirectory = path.join(dataDirectory, "temporary-uploads");
const generatedImagesDirectory = path.join(dataDirectory, "generated-images");

declare global {
  var __zaojingTemplateWriteQueue: Promise<void> | undefined;
}

async function withTemplateWriteLock<T>(operation: () => Promise<T>) {
  const previous = globalThis.__zaojingTemplateWriteQueue ?? Promise.resolve();
  let release: () => void = () => {};
  globalThis.__zaojingTemplateWriteQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(uploadsDirectory, { recursive: true });
  await mkdir(temporaryUploadsDirectory, { recursive: true });
  await mkdir(generatedImagesDirectory, { recursive: true });

  try {
    await readFile(templatesFile, "utf8");
  } catch {
    await writeFile(templatesFile, JSON.stringify(seedTemplates, null, 2), "utf8");
  }
}

export async function getAllTemplates(): Promise<StudioTemplate[]> {
  await ensureStore();
  const raw = await readFile(templatesFile, "utf8");
  return JSON.parse(raw) as StudioTemplate[];
}

export async function getPublishedTemplates(): Promise<PublicTemplate[]> {
  const templates = await getAllTemplates();
  return templates
    .filter((template) => template.status === "published")
    .map(toPublicTemplate);
}

export async function getPublicTemplateBySlug(
  slug: string,
): Promise<PublicTemplate | undefined> {
  const templates = await getAllTemplates();
  const normalizedSlug = normalizeTemplateRouteSlug(slug);
  const template = templates.find(
    (item) => item.slug === normalizedSlug && item.status === "published",
  );
  return template ? toPublicTemplate(template) : undefined;
}

export async function getTemplateById(id: string) {
  const templates = await getAllTemplates();
  return templates.find((item) => item.id === id);
}

export async function saveTemplates(templates: StudioTemplate[]) {
  await withTemplateWriteLock(async () => {
    await ensureStore();
    await writeFile(templatesFile, JSON.stringify(templates, null, 2), "utf8");
  });
}

export async function mutateTemplates<T>(
  mutator: (templates: StudioTemplate[]) => { templates: StudioTemplate[]; result: T },
) {
  return withTemplateWriteLock(async () => {
    await ensureStore();
    const current = JSON.parse(await readFile(templatesFile, "utf8")) as StudioTemplate[];
    const next = mutator(current);
    await writeFile(templatesFile, JSON.stringify(next.templates, null, 2), "utf8");
    return next.result;
  });
}

function extensionFor(file: File) {
  const knownTypes: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  return knownTypes[file.type] ?? path.extname(file.name).toLowerCase() ?? ".bin";
}

function assertUploadableImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("只支持 JPG、PNG 或 WebP 图片");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("单张图片不能超过 20MB");
}

export async function saveUploadedImage(file: File, prefix: string) {
  assertUploadableImage(file);
  await ensureStore();
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const filename = `${safePrefix}-${randomUUID()}${extensionFor(file)}`;
  const diskPath = path.join(uploadsDirectory, filename);
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

export async function saveTemplateImageBuffer(buffer: Buffer, prefix: string) {
  await ensureStore();
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const filename = `${safePrefix}-${randomUUID()}.jpg`;
  await writeFile(path.join(uploadsDirectory, filename), buffer);
  return `/uploads/${filename}`;
}

export async function saveTemporaryInput(file: File, prefix: string) {
  assertUploadableImage(file);
  await ensureStore();
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const filename = `${safePrefix}-${randomUUID()}${extensionFor(file)}`;
  const diskPath = path.join(temporaryUploadsDirectory, filename);
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));
  return diskPath;
}

export async function cleanupExpiredTemporaryInputs() {
  await ensureStore();
  await cleanupExpiredFiles(temporaryUploadsDirectory);
  await cleanupExpiredFiles(generatedImagesDirectory);
}

async function cleanupExpiredFiles(directory: string) {
  const expiryTime = Date.now() - 24 * 60 * 60 * 1000;
  const files = await readdir(directory);
  await Promise.all(
    files.map(async (filename) => {
      const diskPath = path.join(directory, filename);
      const fileStats = await stat(diskPath);
      if (fileStats.mtimeMs < expiryTime) await unlink(diskPath);
    }),
  );
}

function generatedExtension(contentType: string) {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}

export async function saveGeneratedImage(buffer: Buffer, contentType: string) {
  await ensureStore();
  const filename = `${randomUUID()}${generatedExtension(contentType)}`;
  await writeFile(path.join(generatedImagesDirectory, filename), buffer);
  return `/api/generated/${filename}`;
}

export async function readGeneratedImage(filename: string) {
  await ensureStore();
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/i.test(filename)) return undefined;
  const diskPath = path.resolve(generatedImagesDirectory, filename);
  if (path.dirname(diskPath) !== path.resolve(generatedImagesDirectory)) return undefined;
  try {
    const fileStats = await stat(diskPath);
    if (fileStats.mtimeMs < Date.now() - 24 * 60 * 60 * 1000) {
      await unlink(diskPath);
      return undefined;
    }
    return {
      buffer: await readFile(diskPath),
      contentType: filename.endsWith(".jpg")
        ? "image/jpeg"
        : filename.endsWith(".webp")
          ? "image/webp"
          : "image/png",
    };
  } catch {
    return undefined;
  }
}

export function normalizeTemplateRouteSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function makeSlug(value: string, now = Date.now()) {
  const latinSlug = value
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (latinSlug && !/[\u3400-\u9fff]/u.test(value)) return latinSlug;

  const suffix = now.toString(36);
  return latinSlug ? `style-${latinSlug}-${suffix}` : `style-${suffix}`;
}
