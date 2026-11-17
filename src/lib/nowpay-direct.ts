import "server-only";

import type { AlipaySdkCommonResult } from "alipay-sdk";

import { createAlipaySdk } from "./alipay";

const METHOD_PREFIX = "alipay.aipay.nowpaydirect.";

export type NowPayOption = {
  skuId: string;
  label: string;
  quota: number | null;
  amountFen: number | null;
  raw: Record<string, unknown>;
};

export type NowPayProduct = {
  productId: string;
  capabilityStatus: string;
  billingMode: string;
  quotaUnit: string;
  options: NowPayOption[];
};

export type NowPayQuota = {
  quotaUnit: string;
  total: number;
  used: number;
  remaining: number;
  asOfTime?: string;
};

export type NowPayConsumeResult = {
  code: string;
  subCode?: string;
  status: "SUCCEEDED" | "FAILED" | "PROCESSING" | "UNKNOWN";
  consumed?: number;
  remaining?: number;
};

export type NowPayPurchaseEntry = {
  purchaseUrl: string;
  purchaseQrCode?: string;
  expireTime?: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置`);
  return value;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function yuanToFen(value: unknown) {
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  const fen = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(fen) ? fen : undefined;
}

function firstText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return undefined;
}

function firstInteger(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = integer(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstAmountFen(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = yuanToFen(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function assertSuccess(result: AlipaySdkCommonResult, action: string) {
  if (String(result.code ?? "") !== "10000") {
    const detail = String(result.sub_msg || result.msg || "支付宝返回未知错误");
    const error = new Error(`${action}失败：${detail}`) as Error & { code?: string; subCode?: string };
    error.code = String(result.code ?? "");
    error.subCode = String(result.sub_code ?? "");
    throw error;
  }
}

function isAlipayHttpsUrl(url: URL) {
  return url.protocol === "https:"
    && (url.hostname === "alipay.com" || url.hostname.endsWith(".alipay.com"));
}

function validatePurchaseUrl(value: unknown) {
  const raw = text(value);
  if (!raw) throw new Error("即刻收未返回购买链接");
  const parsed = new URL(raw);
  const isAlipayDeepLink = parsed.protocol === "alipays:"
    && parsed.hostname === "platformapi";
  if (!isAlipayHttpsUrl(parsed) && !isAlipayDeepLink) {
    throw new Error("即刻收返回了不受支持的购买入口");
  }
  return raw;
}

function validatePurchaseQrCode(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;
  const parsed = new URL(raw);
  if (!isAlipayHttpsUrl(parsed)) throw new Error("即刻收返回了不受支持的购买二维码");
  return raw;
}

export function parseNowPayPurchaseEntry(result: AlipaySdkCommonResult): NowPayPurchaseEntry {
  assertSuccess(result, "创建即刻收购买入口");
  return {
    purchaseUrl: validatePurchaseUrl(result.purchase_url),
    purchaseQrCode: validatePurchaseQrCode(result.purchase_qr_code),
    expireTime: text(result.expire_time) || undefined,
  };
}

function normalizeOption(value: unknown): NowPayOption | undefined {
  const option = record(value);
  const skuId = firstText(option, ["sku_id", "skuId"]);
  if (!skuId) return undefined;

  const quotaDetails = record(option.quota);
  const quota = firstInteger(option, ["quota_amount", "quota_value", "quantity", "count"])
    ?? firstInteger(quotaDetails, ["amount", "value", "quantity", "count"])
    ?? null;
  const amountFen = firstAmountFen(option, ["price", "sale_price", "selling_price", "amount"])
    ?? null;
  const label = firstText(option, ["sku_name", "option_name", "name", "title", "description"])
    ?? (quota ? `${quota} 次创作` : "创作次数包");

  return { skuId, label, quota, amountFen, raw: option };
}

export function isNowPayDirectEnabled() {
  return process.env.NOWPAY_ENABLED?.trim().toLowerCase() === "true";
}

export function getNowPayProductId() {
  return required("NOWPAY_PRODUCT_ID");
}

export function getNowPayCallbackUrl(purchaseId: string) {
  const baseUrl = required("APP_BASE_URL").replace(/\/$/, "");
  return `${baseUrl}/payment/nowpay/return?purchaseId=${encodeURIComponent(purchaseId)}`;
}

export function assertNowPayDirectEnabled() {
  if (!isNowPayDirectEnabled()) throw new Error("即刻收次数包正在进行上线前校验，请稍后再试");
  assertNowPayDirectConfigured();
}

function assertNowPayDirectConfigured() {
  const status = getNowPayDirectConfigurationStatus();
  if (!status.readyToTest) throw new Error("即刻收直连生产参数尚未配置完成");
  getNowPayProductId();
}

export function getNowPayDirectConfigurationStatus() {
  const requiredNames = ["APP_BASE_URL", "ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_GATEWAY"];
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  const productConfigured = Boolean(process.env.NOWPAY_PRODUCT_ID?.trim());
  const productionGateway = process.env.ALIPAY_GATEWAY?.trim() === "https://openapi.alipay.com/gateway.do";
  const enabled = isNowPayDirectEnabled();
  const readyToTest = missing.length === 0 && productConfigured && productionGateway;
  return {
    configured: missing.length === 0,
    missing,
    productConfigured,
    productionGateway,
    enabled,
    readyToTest,
    active: enabled && readyToTest,
  };
}

export async function queryNowPayProduct(): Promise<NowPayProduct> {
  assertNowPayDirectConfigured();
  const productId = getNowPayProductId();
  const result = await createAlipaySdk().sdk.exec(`${METHOD_PREFIX}charge.query`, {
    bizContent: { outProductId: productId },
  });
  return parseNowPayProductResult(result, productId);
}

export function parseNowPayProductResult(result: AlipaySdkCommonResult, productId: string): NowPayProduct {
  assertSuccess(result, "查询即刻收商品");

  const capabilityStatus = text(result.capability_status);
  const billingMode = text(result.billing_mode);
  const quotaUnit = text(result.quota_unit);
  const options = Array.isArray(result.charging_options)
    ? result.charging_options.map(normalizeOption).filter((item): item is NowPayOption => Boolean(item))
    : [];
  if (!capabilityStatus || !billingMode) throw new Error("即刻收商品返回结构不完整");
  if (billingMode !== "QUANTITY" || quotaUnit !== "COUNT") {
    throw new Error(`即刻收商品必须配置为次数包（当前 ${billingMode || "未知"}/${quotaUnit || "未知"}）`);
  }
  return { productId, capabilityStatus, billingMode, quotaUnit, options };
}

export async function queryNowPayQuota(externalBuyerId: string): Promise<NowPayQuota> {
  assertNowPayDirectConfigured();
  const result = await createAlipaySdk().sdk.exec(`${METHOD_PREFIX}quota.query`, {
    bizContent: {
      outProductId: getNowPayProductId(),
      externalBuyerId,
    },
  });
  return parseNowPayQuotaResult(result);
}

export function parseNowPayQuotaResult(result: AlipaySdkCommonResult): NowPayQuota {
  assertSuccess(result, "查询创作次数");
  const quotaUnit = text(result.quota_unit);
  const total = integer(result.total);
  const used = integer(result.used);
  const remaining = integer(result.remaining);
  if (quotaUnit !== "COUNT" || total === undefined || used === undefined || remaining === undefined) {
    throw new Error("即刻收次数余额返回结构不完整");
  }
  return { quotaUnit, total, used, remaining, asOfTime: text(result.as_of_time) || undefined };
}

export async function createNowPayPurchase(input: {
  outRequestNo: string;
  externalBuyerId: string;
  skuId?: string;
  callbackUrl: string;
}) {
  assertNowPayDirectEnabled();
  const bizContent: Record<string, unknown> = {
    outRequestNo: input.outRequestNo,
    outProductId: getNowPayProductId(),
    externalBuyerId: input.externalBuyerId,
    callbackUrl: input.callbackUrl,
  };
  if (input.skuId) bizContent.skuId = input.skuId;
  const result = await createAlipaySdk().sdk.exec(`${METHOD_PREFIX}purchase.create`, { bizContent });
  return parseNowPayPurchaseEntry(result);
}

export function parseNowPayConsumeResult(result: AlipaySdkCommonResult): NowPayConsumeResult {
  const code = text(result.code);
  const subCode = text(result.sub_code) || undefined;
  const rawStatus = text(result.consume_status);
  const status = rawStatus === "SUCCEEDED" || rawStatus === "FAILED" || rawStatus === "PROCESSING"
    ? rawStatus
    : "UNKNOWN";
  return {
    code,
    subCode,
    status,
    consumed: integer(result.consumed),
    remaining: integer(result.remaining),
  };
}

export async function verifyNowPayQuota(input: {
  outRequestNo: string;
  externalBuyerId: string;
  amount: number;
  consumeReason: string;
}) {
  assertNowPayDirectEnabled();
  const result = await createAlipaySdk().sdk.exec(`${METHOD_PREFIX}quota.verify`, {
    bizContent: {
      outRequestNo: input.outRequestNo,
      outProductId: getNowPayProductId(),
      externalBuyerId: input.externalBuyerId,
      amount: input.amount,
      consumeReason: input.consumeReason,
    },
  });
  return parseNowPayConsumeResult(result);
}

export async function refreshNowPayQuota(input: { outRequestNo: string; externalBuyerId: string }) {
  assertNowPayDirectEnabled();
  const result = await createAlipaySdk().sdk.exec(`${METHOD_PREFIX}quota.refresh`, {
    bizContent: {
      outRequestNo: input.outRequestNo,
      outProductId: getNowPayProductId(),
      externalBuyerId: input.externalBuyerId,
    },
  });
  return parseNowPayConsumeResult(result);
}
