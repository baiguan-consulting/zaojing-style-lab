import assert from "node:assert/strict";
import test from "node:test";

import {
  parseNowPayConsumeResult,
  parseNowPayPurchaseEntry,
  parseNowPayProductResult,
  parseNowPayQuotaResult,
} from "../src/lib/nowpay-direct";

test("accepts the official Alipay app deep link and hosted QR code", () => {
  const entry = parseNowPayPurchaseEntry({
    code: "10000",
    msg: "Success",
    purchase_url: "alipays://platformapi/startapp?appId=example",
    purchase_qr_code: "https://mobilecodec.alipay.com/show.htm?code=example",
    expire_time: "2026-11-16 10:30:00",
  });
  assert.match(entry.purchaseUrl, /^alipays:\/\/platformapi\//);
  assert.match(entry.purchaseQrCode ?? "", /^https:\/\/mobilecodec\.alipay\.com\//);
});

test("rejects purchase entries outside official Alipay schemes and hosts", () => {
  assert.throws(() => parseNowPayPurchaseEntry({
    code: "10000",
    msg: "Success",
    purchase_url: "javascript:alert(1)",
  }), /不受支持/);
  assert.throws(() => parseNowPayPurchaseEntry({
    code: "10000",
    msg: "Success",
    purchase_url: "alipays://platformapi/startapp?appId=example",
    purchase_qr_code: "https://example.com/not-alipay",
  }), /不受支持/);
});

test("parses an enabled quantity-count product and its sku options", () => {
  const product = parseNowPayProductResult({
    code: "10000",
    msg: "Success",
    capability_status: "ENABLED",
    billing_mode: "QUANTITY",
    quota_unit: "COUNT",
    charging_options: [
      { sku_id: "sku-1", sku_name: "单次体验", quota_amount: 1, price: "0.50" },
      { sku_id: "sku-10", option_name: "10 次包", quota_value: "10", sale_price: "5.00" },
    ],
  }, "DIRECT_test");

  assert.equal(product.capabilityStatus, "ENABLED");
  assert.equal(product.options[0].quota, 1);
  assert.equal(product.options[0].amountFen, 50);
  assert.equal(product.options[1].skuId, "sku-10");
  assert.equal(product.options[1].amountFen, 500);
});

test("rejects a product that is not a count package", () => {
  assert.throws(() => parseNowPayProductResult({
    code: "10000",
    msg: "Success",
    capability_status: "ENABLED",
    billing_mode: "ONE_TIME",
    quota_unit: "",
    charging_options: [],
  }, "DIRECT_test"), /必须配置为次数包/);
});

test("uses provider remaining instead of deriving total minus used", () => {
  const quota = parseNowPayQuotaResult({
    code: "10000",
    msg: "Success",
    quota_unit: "COUNT",
    total: 20,
    used: 7,
    remaining: 11,
    as_of_time: "2026-11-15 10:00:00",
  });
  assert.equal(quota.remaining, 11);
});

test("keeps processing consumption unresolved without inventing amounts", () => {
  const result = parseNowPayConsumeResult({
    code: "10000",
    msg: "Success",
    consume_status: "PROCESSING",
  });
  assert.equal(result.status, "PROCESSING");
  assert.equal(result.consumed, undefined);
  assert.equal(result.remaining, undefined);
});
