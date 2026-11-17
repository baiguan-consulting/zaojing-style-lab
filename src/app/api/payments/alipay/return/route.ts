import { type NextRequest, NextResponse } from "next/server";

import { verifyAlipayParameters } from "@/lib/alipay";
import { authenticateRequest } from "@/lib/auth";
import { syncOrderWithAlipay } from "@/lib/payment-service";
import { getOrderByOutTradeNo } from "@/lib/payment-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const publicBaseUrl = process.env.APP_BASE_URL?.trim() || request.url;
  const resultUrl = new URL("/payment/return", publicBaseUrl);
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const outTradeNo = params.out_trade_no;
    if (!outTradeNo || !params.sign || !verifyAlipayParameters(params)) {
      resultUrl.searchParams.set("state", "invalid");
      return NextResponse.redirect(resultUrl);
    }
    const order = await getOrderByOutTradeNo(outTradeNo);
    const user = await authenticateRequest(request);
    if (!order || !user || order.userId !== user.id) {
      resultUrl.searchParams.set("state", "missing");
      return NextResponse.redirect(resultUrl);
    }
    await syncOrderWithAlipay(order).catch(() => order);
    resultUrl.searchParams.set("orderId", order.id);
    resultUrl.searchParams.set("state", "checking");
    return NextResponse.redirect(resultUrl);
  } catch {
    resultUrl.searchParams.set("state", "error");
    return NextResponse.redirect(resultUrl);
  }
}
