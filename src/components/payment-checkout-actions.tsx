"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle, Printer } from "lucide-react";

import type { Locale } from "@/lib/locale";

export function PaymentCheckoutActions({ orderId, canPay, locale = "zh" }: { orderId: string; canPay: boolean; locale?: Locale }) {
  const english = locale === "en";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? (english ? "Could not start Alipay checkout" : "支付宝支付发起失败"));

      const container = document.createElement("div");
      container.hidden = true;
      container.innerHTML = data.paymentHtml;
      document.body.appendChild(container);
      const form = container.querySelector("form");
      if (!(form instanceof HTMLFormElement)) throw new Error(english ? "Could not create the Alipay payment form" : "支付宝支付表单生成失败");
      form.submit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (english ? "Could not start Alipay checkout" : "支付宝支付发起失败"));
      setLoading(false);
    }
  }

  return (
    <div className="order-action-area">
      <div className="order-actions">
        <button className="order-print-button" type="button" onClick={() => window.print()}>
          <Printer /> {english ? "Print / save order" : "打印 / 保存订单"}
        </button>
        {canPay && (
          <button className="order-pay-button" type="button" onClick={checkout} disabled={loading}>
            {loading ? <LoaderCircle className="spin" /> : <CreditCard />}
            {loading ? (english ? "Opening Alipay" : "正在跳转支付宝") : (english ? "Confirm and pay with Alipay" : "确认信息，支付宝支付")}
          </button>
        )}
      </div>
      {error && <p className="payment-error order-payment-error">{error}</p>}
    </div>
  );
}
