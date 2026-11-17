"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, PlugZap, XCircle } from "lucide-react";

export function ProviderTest({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function testConnection() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/admin/providers/boxai/test", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "连接失败");
      const imageModels = payload.availableModels.length
        ? `图片模型：${payload.availableModels.join("、")}`
        : "图片模型：目标模型未出现在列表中";
      const organizerModels = payload.availableTemplateTextModels.length
        ? `模板整理模型：${payload.availableTemplateTextModels.join(" → ")}`
        : "模板整理模型：三个目标模型均未出现在列表中";
      setMessage(`${imageModels}；${organizerModels}。共返回 ${payload.modelCount} 个模型。`);
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "连接失败");
      setStatus("error");
    }
  }

  return (
    <div className="provider-test-block">
      <button type="button" className="admin-primary" onClick={testConnection} disabled={!configured || status === "loading"}>
        {status === "loading" ? <LoaderCircle className="spin" /> : <PlugZap />} 测试 BoxAI 连接
      </button>
      {!configured && <p className="provider-message warning"><XCircle /> 请先在 `.env.local` 中填写 `BOXAI_API_KEY`，再重启开发服务。</p>}
      {status === "success" && <p className="provider-message success"><CheckCircle2 /> {message}</p>}
      {status === "error" && <p className="provider-message error"><XCircle /> {message}</p>}
    </div>
  );
}
