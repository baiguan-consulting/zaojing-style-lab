import type { PaymentOrderStatus } from "./payment-store";

const ORDER_STATUS_LABELS: Record<PaymentOrderStatus, string> = {
  CREATED: "待确认支付",
  PENDING_PAYMENT: "等待付款",
  PAID: "支付成功",
  CLOSED: "交易关闭",
  REFUNDED: "已全额退款",
  PARTIALLY_REFUNDED: "已部分退款",
  FAILED: "订单异常",
};

const ORDER_STATUS_LABELS_EN: Record<PaymentOrderStatus, string> = {
  CREATED: "Awaiting confirmation",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  CLOSED: "Closed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  FAILED: "Order issue",
};

export function orderStatusLabel(status: string, locale: "zh" | "en" = "zh") {
  const labels = locale === "en" ? ORDER_STATUS_LABELS_EN : ORDER_STATUS_LABELS;
  return labels[status as PaymentOrderStatus] ?? status;
}

export function formatBeijingDateTime(value: string, locale: "zh" | "en" = "zh") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
