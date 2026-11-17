"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, MessageSquareText } from "lucide-react";

import type { Locale } from "@/lib/locale";

export function EmailLoginForm({ nextPath = "/", locale = "zh" }: { nextPath?: string; locale?: Locale }) {
  const router = useRouter();
  const english = locale === "en";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function requestCode() {
    setError("");
    setLoading("send");
    try {
      const response = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? (english ? "Could not send the code" : "验证码发送失败"));
      setCodeRequested(true);
      setCooldown(Number(data.retryAfter) || 60);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (english ? "Could not send the code" : "验证码发送失败"));
    } finally {
      setLoading(null);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codeRequested) {
      await requestCode();
      return;
    }
    setError("");
    setLoading("verify");
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? (english ? "Sign-in failed" : "登录失败"));
      router.push(nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (english ? "Sign-in failed. Please try again." : "登录失败，请稍后重试"));
      setLoading(null);
    }
  }

  return (
    <form className="email-login-form" onSubmit={verify}>
      <div className="login-form-heading">
        <span><Mail size={17} /> EMAIL SIGN IN</span>
        <h1>{english ? "Email sign in" : "邮箱登录"}</h1>
        <p>{english ? "No password needed. A new account is created after verification." : "无需设置密码，新用户验证后将自动创建账户。"}</p>
      </div>

      <label className="login-field">
        <span>{english ? "Email address" : "邮箱地址"}</span>
        <div className="email-input-wrap">
          <Mail />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            disabled={loading !== null}
          />
        </div>
      </label>

      {codeRequested && (
        <label className="login-field">
          <span>{english ? "Email verification code" : "邮件验证码"}</span>
          <div className="code-input-wrap">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder={english ? "6-digit code" : "6 位验证码"}
              autoFocus
              required
              disabled={loading !== null}
            />
            <button type="button" onClick={requestCode} disabled={cooldown > 0 || loading !== null}>
              {loading === "send" ? <LoaderCircle className="spin" /> : cooldown > 0 ? `${cooldown}s` : (english ? "Resend" : "重新发送")}
            </button>
          </div>
        </label>
      )}

      {error && <p className="login-error">{error}</p>}

      <button className="login-submit" type="submit" disabled={loading !== null || (codeRequested && code.length !== 6)}>
        {loading ? <LoaderCircle className="spin" /> : codeRequested ? <MessageSquareText /> : <ArrowRight />}
        {loading === "send" ? (english ? "Sending" : "正在发送") : loading === "verify" ? (english ? "Signing in" : "正在登录") : codeRequested ? (english ? "Verify and sign in" : "验证并登录") : (english ? "Send verification code" : "获取验证码")}
      </button>

      <div className="login-assurances">
        <span><CheckCircle2 /> {english ? "Stay signed in for 30 days" : "30 天免登录"}</span>
        <span><LockKeyhole /> {english ? "Private style prompts stay hidden" : "不向用户展示模板提示词"}</span>
      </div>
      <p className="login-agreement">{english ? "By signing in, you agree that the platform may use your email for verification, account security, and essential service messages." : "登录即表示你同意平台使用邮箱完成身份验证、账户安全管理和必要的服务通知。"}</p>
    </form>
  );
}
