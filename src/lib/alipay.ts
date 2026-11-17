import "server-only";

import { randomBytes } from "node:crypto";
import { AlipaySdk, type AlipaySdkCommonResult } from "alipay-sdk";

import type { PaymentOrder, RefundRecord } from "./payment-store";

const ALIPAY_GATEWAYS = new Set([
  "https://openapi.alipay.com/gateway.do",
  "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
]);

type AlipayRuntimeConfig = {
  appId: string;
  alipayPublicKey: string;
  sellerId?: string;
  sellerEmail?: string;
  notifyUrl?: string;
  returnUrl: string;
  gateway: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置`);
  return value;
}

function getRuntimeConfig(): AlipayRuntimeConfig {
  const appBaseUrl = required("APP_BASE_URL").replace(/\/$/, "");
  const gateway = required("ALIPAY_GATEWAY");
  if (!ALIPAY_GATEWAYS.has(gateway)) throw new Error("ALIPAY_GATEWAY 不是受支持的支付宝网关");

  const notifyUrl = process.env.ALIPAY_NOTIFY_URL?.trim();
  if (notifyUrl && (!notifyUrl.startsWith("https://") || new URL(notifyUrl).username)) {
    throw new Error("ALIPAY_NOTIFY_URL 必须是无用户信息的 HTTPS 公网地址");
  }

  return {
    appId: required("ALIPAY_APP_ID"),
    alipayPublicKey: required("ALIPAY_PUBLIC_KEY"),
    sellerId: process.env.ALIPAY_SELLER_ID?.trim() || undefined,
    sellerEmail: process.env.ALIPAY_SELLER_EMAIL?.trim() || undefined,
    notifyUrl,
    returnUrl: `${appBaseUrl}/api/payments/alipay/return`,
    gateway,
  };
}

export function createAlipaySdk() {
  const config = getRuntimeConfig();
  return {
    config,
    sdk: new AlipaySdk({
      appId: config.appId,
      privateKey: required("ALIPAY_PRIVATE_KEY"),
      alipayPublicKey: config.alipayPublicKey,
      gateway: config.gateway,
      signType: "RSA2",
      keyType: "PKCS1",
      camelcase: false,
      timeout: 10_000,
    }),
  };
}

export function formatAmountFen(amountFen: number) {
  if (!Number.isInteger(amountFen) || amountFen < 1) throw new Error("支付金额不合法");
  return `${Math.floor(amountFen / 100)}.${String(amountFen % 100).padStart(2, "0")}`;
}

function normalizeAmountText(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  return `${BigInt(match[1]).toString()}.${(match[2] ?? "").padEnd(2, "0")}`;
}

export function amountTextEqualsFen(value: string, amountFen: number) {
  return normalizeAmountText(value) === formatAmountFen(amountFen);
}

function assertApiSuccess(result: AlipaySdkCommonResult, action: string) {
  if (result.code !== "10000") {
    const detail = result.sub_msg || result.msg || "支付宝返回未知错误";
    throw new Error(`${action}失败：${detail}`);
  }
}

export function createAlipayPaymentHtml(order: PaymentOrder) {
  const { sdk, config } = createAlipaySdk();
  const request: Parameters<typeof sdk.pageExec>[2] = {
    returnUrl: config.returnUrl,
    bizContent: {
      out_trade_no: order.outTradeNo,
      total_amount: formatAmountFen(order.amountFen),
      subject: order.subject,
      product_code: "FAST_INSTANT_TRADE_PAY",
    },
  };
  if (config.notifyUrl) request.notifyUrl = config.notifyUrl;
  return sdk.pageExec("alipay.trade.page.pay", "POST", request);
}

export async function queryAlipayTrade(order: PaymentOrder) {
  const { sdk } = createAlipaySdk();
  const result = await sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: order.outTradeNo },
  });
  assertApiSuccess(result, "交易查询");
  return result;
}

export async function closeAlipayTrade(order: PaymentOrder) {
  const { sdk } = createAlipaySdk();
  const result = await sdk.exec("alipay.trade.close", {
    bizContent: { out_trade_no: order.outTradeNo },
  });
  assertApiSuccess(result, "关闭交易");
  return result;
}

export async function refundAlipayTrade(order: PaymentOrder, refund: RefundRecord) {
  const { sdk } = createAlipaySdk();
  const result = await sdk.exec("alipay.trade.refund", {
    bizContent: {
      out_trade_no: order.outTradeNo,
      refund_amount: formatAmountFen(refund.amountFen),
      refund_reason: refund.reason,
      out_request_no: refund.outRequestNo,
    },
  });
  assertApiSuccess(result, "退款请求");
  return result;
}

export async function queryAlipayRefund(order: PaymentOrder, refund: RefundRecord) {
  const { sdk } = createAlipaySdk();
  const result = await sdk.exec("alipay.trade.fastpay.refund.query", {
    bizContent: {
      out_trade_no: order.outTradeNo,
      out_request_no: refund.outRequestNo,
    },
  });
  assertApiSuccess(result, "退款查询");
  return result;
}

export function verifyAlipayParameters(params: Record<string, string>) {
  const { sdk } = createAlipaySdk();
  return sdk.checkNotifySignV2(params);
}

export function validateNotificationBusinessFields(
  order: PaymentOrder,
  params: Record<string, string>,
) {
  const config = getRuntimeConfig();
  const sellerMatches = Boolean(
    (config.sellerId && params.seller_id === config.sellerId)
      || (config.sellerEmail && params.seller_email === config.sellerEmail),
  );
  if (!config.sellerId && !config.sellerEmail) {
    throw new Error("必须配置 ALIPAY_SELLER_ID 或 ALIPAY_SELLER_EMAIL 才能处理异步通知");
  }
  return params.app_id === config.appId
    && params.out_trade_no === order.outTradeNo
    && amountTextEqualsFen(params.total_amount ?? "", order.amountFen)
    && sellerMatches;
}

export function isPaidTradeStatus(status: string | undefined) {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

export function getAlipayConfigurationStatus() {
  const requiredNames = [
    "APP_BASE_URL",
    "APP_SESSION_SECRET",
    "ALIPAY_APP_ID",
    "ALIPAY_PRIVATE_KEY",
    "ALIPAY_PUBLIC_KEY",
    "ALIPAY_GATEWAY",
  ];
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  const notifyUrl = process.env.ALIPAY_NOTIFY_URL?.trim() ?? "";
  const expectedNotifyUrl = appBaseUrl ? `${appBaseUrl}/api/payments/alipay/notify` : "";
  const productionGateway = process.env.ALIPAY_GATEWAY?.trim() === "https://openapi.alipay.com/gateway.do";
  const notifyConfigured = Boolean(notifyUrl);
  const notifyMatchesExpected = Boolean(expectedNotifyUrl) && notifyUrl === expectedNotifyUrl;
  const sellerConfigured = Boolean(
    process.env.ALIPAY_SELLER_ID?.trim() || process.env.ALIPAY_SELLER_EMAIL?.trim(),
  );
  const paymentsEnabled = process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
  const readyToEnable = missing.length === 0
    && productionGateway
    && notifyConfigured
    && notifyMatchesExpected
    && sellerConfigured;
  return {
    configured: missing.length === 0,
    missing,
    paymentsEnabled,
    productionGateway,
    notifyConfigured,
    notifyMatchesExpected,
    expectedNotifyUrl,
    sellerConfigured,
    readyToEnable,
    active: paymentsEnabled && readyToEnable,
  };
}

export function assertAlipayCheckoutAvailable() {
  const status = getAlipayConfigurationStatus();
  if (!status.paymentsEnabled) {
    throw new Error("支付功能正在进行上线前校验，请稍后再试");
  }
  if (!status.readyToEnable) {
    throw new Error("支付宝生产配置尚未完成，请联系管理员");
  }
}

export async function testAlipayProductionConnection() {
  const status = getAlipayConfigurationStatus();
  if (!status.readyToEnable) {
    throw new Error("请先补齐支付宝生产应用参数、生产网关、通知地址和收款方身份");
  }

  const { sdk } = createAlipaySdk();
  const outTradeNo = `ZJPROBE${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
  const result = await sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: outTradeNo },
  });
  const code = String(result.code ?? "");
  const subCode = String(result.sub_code ?? "");
  const connected = code === "10000" || subCode === "ACQ.TRADE_NOT_EXIST";
  if (!connected) {
    throw new Error(`支付宝签名查询未通过（${subCode || code || "UNKNOWN"}）`);
  }
  return { connected: true, result: subCode === "ACQ.TRADE_NOT_EXIST" ? "SIGNED_QUERY_ACCEPTED" : "QUERY_ACCEPTED" };
}
