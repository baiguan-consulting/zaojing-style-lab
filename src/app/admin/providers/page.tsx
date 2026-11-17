import { CheckCircle2, KeyRound, LockKeyhole, Server, Sparkles } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { ProviderTest } from "@/components/provider-test";
import { getBoxAIStatus } from "@/lib/boxai";

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  const status = getBoxAIStatus();

  return (
    <AdminShell active="providers">
      <div className="admin-page-header">
        <div><span className="admin-kicker">MODEL PROVIDER</span><h1>模型服务</h1><p>密钥只从服务端环境变量读取，不保存到模板或发送给浏览器。</p></div>
      </div>

      <section className="provider-card">
        <div className="provider-card-head">
          <span className="provider-logo">B</span>
          <div><small>IMAGE PROVIDER</small><h2>BoxAI</h2><p>OpenAI-compatible gateway · you-box.com</p></div>
          <span className={`provider-status ${status.configured ? "ready" : "pending"}`}>{status.configured ? "密钥已配置" : "等待密钥"}</span>
        </div>
        <div className="provider-details">
          <article><Server /><span><small>BASE URL</small><strong>{status.baseUrl}</strong></span></article>
          <article><KeyRound /><span><small>AUTH</small><strong>Bearer · BOXAI_API_KEY</strong></span></article>
          <article><LockKeyhole /><span><small>KEY VISIBILITY</small><strong>仅服务端可见</strong></span></article>
        </div>
        <div className="provider-models">
          <h3><Sparkles /> 已启用图片模型</h3>
          {status.models.map((model, index) => <span key={model}><CheckCircle2 /> {model}<small>{index === 0 ? "默认" : "可选"}</small></span>)}
        </div>
        <div className="provider-models">
          <h3><Sparkles /> 模板 AI 整理顺序</h3>
          {status.templateTextModels.map((model, index) => <span key={model}><CheckCircle2 /> {model}<small>优先级 {index + 1}</small></span>)}
        </div>
        <div className="env-guide">
          <strong>本地密钥文件</strong>
          <code>D:\一键生图聚合平台\.env.local</code>
          <pre>{`BOXAI_BASE_URL=https://you-box.com/v1\nBOXAI_API_KEY=在这里粘贴你的真实密钥`}</pre>
          <p>图片生成与模板 AI 整理共用同一组 Base URL 和 API Key。保存文件后重启 `npm run dev`，再点击连接测试。密钥不要发到聊天、截图或提交到 Git。</p>
        </div>
        <ProviderTest configured={status.configured} />
      </section>
    </AdminShell>
  );
}
