"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CreatorProfileForm({
  initialName = "",
  initialBio = "",
}: {
  initialName?: string;
  initialBio?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/creator/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: form.get("displayName"),
          bio: form.get("bio"),
          acceptTerms: form.get("acceptTerms") === "on",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="creator-onboarding-form" onSubmit={submit}>
      <label><span>公开创作者昵称</span><input name="displayName" defaultValue={initialName} maxLength={30} placeholder="例如：山野设计室" required /></label>
      <label><span>一句话介绍</span><textarea name="bio" defaultValue={initialBio} maxLength={240} rows={3} placeholder="介绍你的风格方向和擅长内容" /></label>
      <label className="creator-terms-check">
        <input name="acceptTerms" type="checkbox" required />
        <span>我已阅读创作者规则，并确认投稿提示词与案例图拥有发布及商业使用权。</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="creator-primary-button" disabled={saving}>
        {saving ? <LoaderCircle className="spin" /> : <Sparkles />} {saving ? "正在开通…" : "开通创作者中心"}
      </button>
    </form>
  );
}
