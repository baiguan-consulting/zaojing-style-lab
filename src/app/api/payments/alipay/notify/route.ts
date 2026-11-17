import { type NextRequest } from "next/server";

import {
  isPaidTradeStatus,
  validateNotificationBusinessFields,
  verifyAlipayParameters,
} from "@/lib/alipay";
import { hashNotifyPayload } from "@/lib/payment-service";
import {
  getOrderByOutTradeNo,
  markOrderPaid,
  recordPaymentEvent,
} from "@/lib/payment-store";

export const runtime = "nodejs";

function text(value: "success" | "fail") {
  return new Response(value, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params[key] = value;
    }
    if (!params.sign || !verifyAlipayParameters(params)) return text("fail");

    const order = await getOrderByOutTradeNo(params.out_trade_no ?? "");
    if (!order || !validateNotificationBusinessFields(order, params)) return text("fail");

    const notifyId = params.notify_id?.trim();
    const tradeNo = params.trade_no?.trim();
    const tradeStatus = params.trade_status?.trim();
    if (!notifyId || !tradeNo || !tradeStatus) return text("fail");
    const payloadHash = hashNotifyPayload(params);
    const isPaidEvent = isPaidTradeStatus(tradeStatus)
      && !params.out_biz_no
      && !params.gmt_refund
      && !params.refund_fee;

    if (isPaidEvent) {
      await markOrderPaid({
        orderId: order.id,
        tradeNo,
        notifyId,
        tradeStatus,
        payloadHash,
      });
    } else {
      await recordPaymentEvent({
        notifyId,
        outTradeNo: order.outTradeNo,
        tradeNo,
        tradeStatus,
        payloadHash,
      });
    }
    return text("success");
  } catch {
    return text("fail");
  }
}
