import assert from "node:assert/strict";
import test from "node:test";

import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";

import { config, proxy } from "../src/proxy";
import { localizedPath } from "../src/lib/locale";

test("localizes public paths while keeping service and workspace routes unprefixed", () => {
  assert.equal(localizedPath("en", "/"), "/en");
  assert.equal(localizedPath("en", "/#templates"), "/en/#templates");
  assert.equal(localizedPath("en", "/templates/vintage-travel-stamp?from=home#examples"), "/en/templates/vintage-travel-stamp?from=home#examples");
  assert.equal(localizedPath("zh", "/en/templates/vintage-travel-stamp"), "/templates/vintage-travel-stamp");
  assert.equal(localizedPath("en", "/api/account"), "/api/account");
  assert.equal(localizedPath("en", "/admin"), "/admin");
  assert.equal(localizedPath("en", "/creator"), "/creator");
});

test("proxy only matches supported English consumer routes", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
  assert.equal(matches("/en"), true);
  assert.equal(matches("/en/templates/vintage-travel-stamp"), true);
  assert.equal(matches("/en/credits/orders/order-1"), true);
  assert.equal(matches("/en/api/account"), false);
  assert.equal(matches("/en/admin"), false);
  assert.equal(matches("/templates/vintage-travel-stamp"), false);
});

test("proxy rewrites English URLs internally and persists the locale cookie", () => {
  const response = proxy(new NextRequest("https://picture.baiguan-consulting.com/en/templates/vintage-travel-stamp?from=test"));
  assert.equal(isRewrite(response), true);
  assert.equal(
    getRewrittenUrl(response),
    "https://picture.baiguan-consulting.com/templates/vintage-travel-stamp?from=test",
  );
  assert.match(response.headers.get("set-cookie") ?? "", /zaojing_locale=en/);
});
