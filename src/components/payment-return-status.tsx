"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { localizedPath, type Locale } from "@/lib/locale";

type OrderStatus = {
  status: string;
  credits: number;
  providerCheckPending?: boolean;
};

export function PaymentReturnStatus({ orderId, initialState, locale = "zh" }: { orderId?: string; initialState?: string; locale?: Locale }) {
  const english = locale === "en";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState(initialState && initialState !== "checking" ? (english ? "The payment return could not be verified. Check the order page." : "支付回跳信息未通过校验，请到订单页确认。") : "");

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/payments/orders/${orderId}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? (english ? "Could not check the order" : "订单查询失败"));
        if (stopped) return;
        setOrder(data);
        if (!["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CLOSED", "FAILED"].includes(data.status)) {
          timer = setTimeout(poll, 3000);
        }
      } catch (caught) {
        if (!stopped) setError(caught instanceof Error ? caught.message : (english ? "Could not check the order" : "订单查询失败"));
      }
    }

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [english, orderId]);

  const paid = order && ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status);

  return (
    <section className="payment-return-card">
      {paid ? (
        <>
          <span className="payment-state-icon success"><Check /></span>
          <small>PAYMENT CONFIRMED</small>
          <h1>{english ? "Payment confirmed" : "支付成功，次数已到账"}</h1>
          <p>{english ? `${order.credits} creation credits were added to your account. You can return to the styles and keep creating.` : `本次购买的 ${order.credits} 次创作已经加入账户，可以返回模板继续生成。`}</p>
          <div className="payment-return-actions">
            <Link className="primary-button" href={localizedPath(locale, "/#templates")}>{english ? "Choose a style" : "去选择模板"}</Link>
            <Link className="secondary-button" href={localizedPath(locale, orderId ? `/credits/orders/${orderId}` : "/credits")}>{english ? "View order" : "查看订单"}</Link>
          </div>
        </>
      ) : error ? (
        <>
          <span className="payment-state-icon warning"><CircleAlert /></span>
          <small>PAYMENT NEEDS CHECK</small>
          <h1>{english ? "Payment needs confirmation" : "支付结果需要确认"}</h1>
          <p>{error} {english ? "If Alipay charged you, do not pay again. Check your account later." : "如果支付宝已经扣款，请不要重复支付，稍后在账户页查看。"}</p>
          <Link className="primary-button" href={localizedPath(locale, "/credits")}>{english ? "Back to account" : "返回账户"}</Link>
        </>
      ) : (
        <>
          <span className="payment-state-icon"><LoaderCircle className="spin" /></span>
          <small>VERIFYING PAYMENT</small>
          <h1>{english ? "Confirming payment" : "正在确认支付结果"}</h1>
          <p>{english ? "We verify the order with Alipay on the server instead of trusting the browser return alone." : "页面不会依据浏览器回跳直接判定成功，正在通过服务端查询支付宝订单。"}</p>
        </>
      )}
    </section>
  );
}
