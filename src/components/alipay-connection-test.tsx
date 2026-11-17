"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, PlugZap, XCircle } from "lucide-react";

export function AlipayConnectionTest({
  ready,
  endpoint = "/api/admin/payments/alipay/test",
  buttonText = "测试支付宝签名连接",
  successText = "生产网关已接受签名查询，应用身份与密钥可以继续进行真实小额支付验收。",
}: {
  ready: boolean;
  endpoint?: string;
  buttonText?: string;
  successText?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function testConnection() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "支付宝连接测试失败");
      setMessage(successText);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支付宝连接测试失败");
      setState("error");
    }
  }

  return (
    <div className="provider-test-block payment-connection-test">
      <button type="button" className="admin-primary" onClick={testConnection} disabled={!ready || state === "loading"}>
        {state === "loading" ? <LoaderCircle className="spin" /> : <PlugZap />} {buttonText}
      </button>
      {!ready && <p className="provider-message warning"><XCircle /> 生产参数齐全后才能执行无扣款签名查询。</p>}
      {state === "success" && <p className="provider-message success"><CheckCircle2 /> {message}</p>}
      {state === "error" && <p className="provider-message error"><XCircle /> {message}</p>}
    </div>
  );
}
