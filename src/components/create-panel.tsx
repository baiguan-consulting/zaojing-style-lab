"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Download, ImagePlus, LoaderCircle, LockKeyhole, Sparkles, Upload, WalletCards, X } from "lucide-react";

import { localizedPath } from "@/lib/locale";
import type { PublicTemplate } from "@/lib/template-types";
import type { Locale } from "@/lib/locale";

type GenerateResult = {
  taskId: string;
  images: string[];
  expiresAt: string;
};

export function CreatePanel({ template, locale }: { template: PublicTemplate; locale: Locale }) {
  const english = locale === "en";
  const pendingTaskKey = `zaojing:pending-task:${template.id}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [count, setCount] = useState(template.allowedCounts[0] ?? 1);
  const [status, setStatus] = useState<"idle" | "uploading" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  async function waitForQuota(taskId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/generation-tasks/${taskId}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 202) continue;
      if (!response.ok) {
        if (response.status === 402 || data.paymentRequired) setPaymentRequired(true);
        throw new Error(data.error ?? (english ? "Could not confirm your credit balance" : "创作次数确认失败"));
      }
      sessionStorage.removeItem(pendingTaskKey);
      return data as GenerateResult;
    }
    throw new Error(english ? "Your image is ready, but credit confirmation is still pending. Reopen this page shortly and do not submit again." : "作品已经生成，创作次数仍在确认中。请稍后重新打开本页面，避免重复提交。");
  }

  useEffect(() => {
    const taskId = sessionStorage.getItem(pendingTaskKey);
    if (!taskId) return;
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setStatus("generating");
      try {
        const data = await waitForQuota(taskId);
        if (!active) return;
        setResult(data);
        setStatus("done");
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : (english ? "Could not confirm your credits" : "创作次数确认失败"));
        setStatus("error");
      }
    });
    return () => { active = false; };
    // The key is stable for the selected template; polling is intentionally resumed once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTaskKey]);

  function selectFile(nextFile?: File) {
    if (!nextFile) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPaymentRequired(false);
    setLoginRequired(false);
    setResult(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userText = String(formData.get("userText") ?? "").trim();

    if (!userText && !file) {
      setError(english ? "Describe your scene or upload an image. Please provide at least one input." : "请填写画面内容或上传一张图片，至少提供一种创作素材。");
      return;
    }

    formData.set("templateId", template.id);
    formData.set("count", String(count));
    if (file) formData.set("inputImage", file);

    try {
      setStatus("uploading");
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStatus("generating");
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok && response.status !== 202) {
        if (response.status === 401 || data.loginRequired) {
          setLoginRequired(true);
        } else if (response.status === 402 || data.paymentRequired) {
          setPaymentRequired(true);
        }
        throw new Error(data.error ?? (english ? "Could not start the generation" : "生成任务创建失败"));
      }
      if (response.status === 202) sessionStorage.setItem(pendingTaskKey, data.taskId);
      const completed = response.status === 202 ? await waitForQuota(data.taskId) : data;
      await new Promise((resolve) => setTimeout(resolve, 800));
      setResult(completed);
      setStatus("done");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : (english ? "Generation failed. Please try again." : "生成失败，请稍后重试"));
    }
  }

  if (status === "done" && result) {
    return (
      <section className="result-panel">
        <div className="result-heading">
          <span className="success-icon"><Check size={22} /></span>
          <div><small>GENERATED</small><h2>{english ? "Your work is ready" : "你的作品已生成"}</h2></div>
        </div>
        <div className="result-grid">
          {result.images.map((image, index) => (
            <figure key={`${image}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={english ? `${template.name} result ${index + 1}` : `${template.name}生成结果 ${index + 1}`} />
              <a href={image} download><Download size={17} /> {english ? `Download ${index + 1}` : `下载第 ${index + 1} 张`}</a>
            </figure>
          ))}
        </div>
        <div className="expiry-warning">
          <Clock3 size={18} />
          <span><strong>{english ? "Download now" : "请立即下载保存"}</strong> {english ? "Uploads and results are permanently deleted after 24 hours and cannot be recovered." : "上传内容和生成结果将在 24 小时后永久删除，无法恢复。"}</span>
        </div>
        <button type="button" className="secondary-button" onClick={() => { setStatus("idle"); setResult(null); }}>
          {english ? "Create another" : "再创作一次"}
        </button>
      </section>
    );
  }

  return (
    <form className="create-panel" onSubmit={submit}>
      <div className="create-title">
        <span>CREATE WITH THIS STYLE</span>
        <h2>{english ? "Create with this style" : "用这个风格创作"}</h2>
        <p>{english ? "The style and output settings are ready. Just bring your content." : "模板风格与输出规格已经锁定，你只需提供画面内容。"}</p>
      </div>

      {template.allowText && (
        <label className="field-block">
          <span className="field-label"><Sparkles size={17} /> {english ? "Describe your scene" : "描述画面"} <small>{english ? "Optional" : "可选"}</small></span>
          <textarea name="userText" maxLength={500} placeholder={template.textPlaceholder} />
          <span className="field-help">{english ? "Text adds subject and scene details without changing the curated style." : "文字只补充主体和场景，不会改变模板风格。"}</span>
        </label>
      )}

      {template.allowImage && (
        <div className="field-block">
          <span className="field-label"><ImagePlus size={17} /> {english ? "Upload your image" : "上传你的图片"} <small>{english ? "Optional" : "可选"}</small></span>
          <input
            ref={fileRef}
            className="sr-only"
            name="inputImagePicker"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          {preview ? (
            <div className="upload-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={english ? "Image ready to upload" : "待上传图片预览"} />
              <button type="button" onClick={clearFile} aria-label={english ? "Remove image" : "移除图片"}><X size={17} /></button>
              <span>{file?.name}</span>
            </div>
          ) : (
            <button type="button" className="upload-zone" onClick={() => fileRef.current?.click()}>
              <Upload size={24} />
              <strong>{english ? "Tap to upload JPG, PNG, or WEBP" : "点击上传 JPG、PNG 或 WEBP"}</strong>
              <span>{english ? "Clear subjects and natural light usually work best" : "主体清晰、光线自然的图片效果更好"}</span>
            </button>
          )}
        </div>
      )}

      <fieldset className="count-picker">
        <legend>{english ? "Number of images" : "生成数量"}</legend>
        {template.allowedCounts.map((value) => (
          <button
            type="button"
            key={value}
            className={count === value ? "active" : ""}
            onClick={() => setCount(value)}
          >
            {value} {english ? (value === 1 ? "image" : "images") : "张"} <small>{value * template.priceCredits} {english ? "credits" : "次"} · ¥{(value * template.priceCredits * 0.5).toFixed(1)}</small>
          </button>
        ))}
      </fieldset>

      <div className="privacy-callout">
        <LockKeyhole size={20} />
        <span><strong>{english ? "24-hour privacy" : "24 小时隐私保护"}</strong> {english ? "Uploads and results are deleted automatically. Download in time." : "原图和生成结果到期自动删除，请及时下载。"}</span>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loginRequired && (
        <Link className="payment-required-link" href={`${localizedPath(locale, "/login")}?next=${encodeURIComponent(localizedPath(locale, `/templates/${template.slug}`))}`}>
          <LockKeyhole size={16} /> {english ? "Sign in with email to continue" : "邮箱登录后继续创作"}
        </Link>
      )}
      {paymentRequired && (
        <Link className="payment-required-link" href={localizedPath(locale, "/credits")}>
          <WalletCards size={16} /> {english ? "Buy creation credits" : "购买创作次数"}
        </Link>
      )}

      <button className="generate-button" type="submit" disabled={status !== "idle" && status !== "error"}>
        {status === "uploading" && <><LoaderCircle className="spin" /> {english ? "Uploading" : "正在上传素材"}</>}
        {status === "generating" && <><LoaderCircle className="spin" /> {english ? "Creating your image" : "正在生成作品"}</>}
        {(status === "idle" || status === "error") && <>{english ? `Create · ${count * template.priceCredits} credits` : `开始生成 · ${count * template.priceCredits} 次`} <Sparkles size={18} /></>}
      </button>
      <p className="prompt-lock-note"><LockKeyhole size={13} /> {english ? "The private style prompt stays hidden" : "模板提示词已锁定，不会向用户公开"}</p>
    </form>
  );
}
