import "server-only";

import { createHash } from "node:crypto";

import {
  amountTextEqualsFen,
  isPaidTradeStatus,
  queryAlipayTrade,
} from "./alipay";
import {
  getOrderById,
  markOrderPaid,
  type PaymentOrder,
  updateOrderStatus,
} from "./payment-store";

export function publicOrder(order: PaymentOrder) {
  return {
    id: order.id,
    outTradeNo: order.outTradeNo,
    packageId: order.packageId,
    subject: order.subject,
    amountFen: order.amountFen,
    credits: order.credits,
    status: order.status,
    alipayTradeNo: order.alipayTradeNo,
    refundedFen: order.refundedFen,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
  };
}

export async function syncOrderWithAlipay(order: PaymentOrder) {
  if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CLOSED"].includes(order.status)) return order;
  const result = await queryAlipayTrade(order);
  const tradeStatus = String(result.trade_status ?? "");
  const tradeNo = String(result.trade_no ?? "");
  const amount = String(result.total_amount ?? "");

  if (isPaidTradeStatus(tradeStatus)) {
    if (!tradeNo || !amountTextEqualsFen(amount, order.amountFen)) {
      throw new Error("支付宝查询结果与本地订单金额不一致");
    }
    const updated = await markOrderPaid({
      orderId: order.id,
      tradeNo,
      tradeStatus,
    });
    return updated.order;
  }
  if (tradeStatus === "TRADE_CLOSED") {
    return updateOrderStatus(order.id, "CLOSED");
  }
  if (tradeStatus === "WAIT_BUYER_PAY") {
    return updateOrderStatus(order.id, "PENDING_PAYMENT");
  }
  return order;
}

export async function refreshOrderById(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("支付订单不存在");
  return syncOrderWithAlipay(order);
}

export function hashNotifyPayload(params: Record<string, string>) {
  const canonical = Object.entries(params)
    .filter(([key]) => key !== "sign")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha256").update(canonical).digest("hex");
}
