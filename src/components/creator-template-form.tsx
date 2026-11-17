"use client";

import { Images, LoaderCircle, Scissors, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

function Preview({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="投稿对照图预览" />;
}

export function CreatorTemplateForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addFiles(next: File[]) {
    setFiles((current) => [...current, ...next.filter((file) => file.type.startsWith("image/"))].slice(0, 8));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!files.length) return setError("请至少上传一张上下对照图");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    files.forEach((file) => form.append("compositeImages", file));
    try {
      const response = await fetch("/api/creator/templates", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "投稿失败");
      router.push("/creator?submitted=1");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "投稿失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="creator-template-form" onSubmit={submit}>
      <section>
        <span className="creator-step">01 · STYLE RECIPE</span>
        <h2>粘贴原始提示词</h2>
        <p>平台会自动去掉“上下对比、原图区域”等规则，锁定为只生成最终风格图。</p>
        <textarea name="rawText" minLength={20} maxLength={30000} rows={14} placeholder="把完整提示词粘贴到这里…" required />
      </section>
      <section>
        <span className="creator-step">02 · BEFORE / AFTER</span>
        <h2>上传上下对照图</h2>
        <p>每张图应为上方原图、下方风格效果图。系统自动拆分，并把对照图用于模板封面。</p>
        <label className="creator-upload-zone"><Images /><span><strong>选择 1–8 张对照图</strong><small>JPG / PNG / WebP，单张不超过 20MB</small></span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => addFiles(Array.from(event.target.files ?? []))} /></label>
        {files.length > 0 && <div className="creator-upload-previews">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}-${index}`}><Preview file={file} /><button type="button" onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></article>)}</div>}
        <label className="creator-clean-toggle"><input type="checkbox" name="cleanScreenshotUi" defaultChecked /><Scissors /><span>自动清理小红书截图中的轮播按钮、页码和圆点</span></label>
      </section>
      <section>
        <span className="creator-step">03 · RIGHTS & REVIEW</span>
        <h2>确认权利并送审</h2>
        <p>创作者模板不会立即公开。管理员会检查素材权利、提示词、案例拆分和生成规则后再发布。</p>
        <label className="creator-terms-check"><input type="checkbox" name="rightsConfirmed" required /><span>我确认拥有提示词和案例图片的发布、展示及商业使用权，并愿意对投稿内容负责。</span></label>
        {error && <p className="form-error">{error}</p>}
        <button className="creator-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Send />} {saving ? "正在拆图并提交…" : "提交管理员审核"}</button>
      </section>
    </form>
  );
}
