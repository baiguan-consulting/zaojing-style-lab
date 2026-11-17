"use client";

import {
  Check,
  ClipboardPaste,
  Images,
  Link2,
  LoaderCircle,
  Save,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  BOXAI_RATIOS,
  BOXAI_SIZE_PRESETS,
  resolveBoxAIHighImageSize,
} from "@/lib/image-sizes";
import {
  COMPARISON_NEGATIVE_PROMPT,
  deriveImportFields,
} from "@/lib/template-import-rules";

type RightsStatus = "reference_only" | "authorized" | "self_created";

type OrganizerAttempt = {
  model: string;
  status: "succeeded" | "failed";
  durationMs: number;
  reason?: string;
};

type OrganizerDraft = {
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  categoryEn: string;
  tags: string[];
  tagsEn: string[];
  ratio: string;
  allowText: boolean;
  allowImage: boolean;
  textPlaceholder: string;
  textPlaceholderEn: string;
  privatePrompt: string;
  negativePrompt: string;
  warnings: string[];
};

function xiaohongshuUrl(value: string) {
  return value.match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/\S+/i)?.[0]
    ?.replace(/[，。！？)）]+$/, "") ?? "";
}

function LocalImagePreview({ file, alt }: { file: File; alt: string }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // Blob URLs only exist in this browser session and cannot use the image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} />;
}

export function QuickImportForm() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [rightsStatus, setRightsStatus] = useState<RightsStatus>("reference_only");
  const [rawText, setRawText] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [tagline, setTagline] = useState("");
  const [taglineEn, setTaglineEn] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [category, setCategory] = useState("艺术插画");
  const [categoryEn, setCategoryEn] = useState("");
  const [tags, setTags] = useState("");
  const [tagsEn, setTagsEn] = useState("");
  const [privatePrompt, setPrivatePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(COMPARISON_NEGATIVE_PROMPT);
  const [allowText, setAllowText] = useState(true);
  const [allowImage, setAllowImage] = useState(true);
  const [textPlaceholder, setTextPlaceholder] = useState("描述画面主体、场景或希望保留的细节");
  const [textPlaceholderEn, setTextPlaceholderEn] = useState("");
  const [outputRatio, setOutputRatio] = useState("3:4");
  const [outputSize, setOutputSize] = useState(resolveBoxAIHighImageSize("3:4"));
  const [model, setModel] = useState("gpt-image-2.5-flare");
  const [compositeFiles, setCompositeFiles] = useState<File[]>([]);
  const [cleanScreenshotUi, setCleanScreenshotUi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [organizerModel, setOrganizerModel] = useState("");
  const [organizerAttempts, setOrganizerAttempts] = useState<OrganizerAttempt[]>([]);
  const [organizerWarnings, setOrganizerWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function applyRuleText(value: string) {
    const nextText = value.trim();
    if (!nextText) return;
    setRawText(nextText);
    const link = xiaohongshuUrl(nextText);
    if (link) setSourceUrl(link);
    const derived = deriveImportFields(nextText);
    setName(derived.name);
    setTagline(derived.tagline);
    setDescription(derived.description);
    setCategory(derived.category);
    setTags(derived.tags);
    setOutputRatio(derived.ratio);
    setOutputSize(resolveBoxAIHighImageSize(derived.ratio));
    setPrivatePrompt(derived.prompt);
    setNegativePrompt(derived.negativePrompt);
    setOrganizerModel("规则引擎");
    setOrganizerAttempts([]);
    setOrganizerWarnings([]);
  }

  function applyAIDraft(draft: OrganizerDraft) {
    setName(draft.name);
    setNameEn(draft.nameEn);
    setTagline(draft.tagline);
    setTaglineEn(draft.taglineEn);
    setDescription(draft.description);
    setDescriptionEn(draft.descriptionEn);
    setCategory(draft.category);
    setCategoryEn(draft.categoryEn);
    setTags(draft.tags.join(", "));
    setTagsEn(draft.tagsEn.join(", "));
    setOutputRatio(draft.ratio);
    setOutputSize(resolveBoxAIHighImageSize(draft.ratio));
    setAllowText(draft.allowText);
    setAllowImage(draft.allowImage);
    setTextPlaceholder(draft.textPlaceholder);
    setTextPlaceholderEn(draft.textPlaceholderEn);
    setPrivatePrompt(draft.privatePrompt);
    setNegativePrompt(draft.negativePrompt);
    setOrganizerWarnings(draft.warnings);
  }

  async function organizeWithAI() {
    setError("");
    setSaved(false);
    if (rawText.trim().length < 20) {
      setError("请先粘贴至少 20 个字符的原始文案或提示词");
      return;
    }
    setOrganizing(true);
    setOrganizerModel("");
    setOrganizerAttempts([]);
    setOrganizerWarnings([]);
    try {
      const response = await fetch("/api/admin/templates/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawText.trim() }),
      });
      const payload = await response.json() as {
        error?: string;
        draft?: OrganizerDraft;
        model?: string;
        attempts?: OrganizerAttempt[];
      };
      setOrganizerAttempts(payload.attempts ?? []);
      if (!response.ok || !payload.draft || !payload.model) {
        throw new Error(payload.error ?? "AI 整理失败");
      }
      applyAIDraft(payload.draft);
      setOrganizerModel(payload.model);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 整理失败，请改用规则整理");
    } finally {
      setOrganizing(false);
    }
  }

  function assignImages(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    setCompositeFiles((current) => [...current, ...images].slice(0, 8));
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    assignImages(files);
    const text = event.clipboardData.getData("text/plain");
    if (text.trim()) applyRuleText(text);
  }

  async function submit(intent: "draft" | "published") {
    setError("");
    setSaved(false);
    if (!compositeFiles.length) {
      setError("请至少添加一张上下分割的对照效果图");
      return;
    }
    if (!name.trim() || !privatePrompt.trim()) {
      setError("请先粘贴并整理提示词，再确认模板名称和固定提示词");
      return;
    }
    if (!allowText && !allowImage) {
      setError("至少允许用户提供文字或图片中的一种");
      return;
    }
    if (intent === "published" && rightsStatus === "reference_only") {
      setError("小红书参考素材请先保存为草稿；获得授权或换成自己的案例图后才能发布");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("nameEn", nameEn.trim());
      formData.set("category", category.trim() || "艺术插画");
      formData.set("categoryEn", categoryEn.trim());
      formData.set("tagline", tagline.trim());
      formData.set("taglineEn", taglineEn.trim());
      formData.set("description", description.trim());
      formData.set("descriptionEn", descriptionEn.trim());
      formData.set("tags", tags.trim());
      formData.set("tagsEn", tagsEn.trim());
      formData.set("privatePrompt", privatePrompt.trim());
      formData.set("negativePrompt", negativePrompt.trim());
      if (allowText) formData.set("allowText", "on");
      if (allowImage) formData.set("allowImage", "on");
      formData.set("textPlaceholder", textPlaceholder.trim());
      formData.set("textPlaceholderEn", textPlaceholderEn.trim());
      formData.set("outputRatio", outputRatio);
      formData.set("outputSize", outputSize);
      formData.set("allowCount2", "on");
      formData.set("priceCredits", "1");
      formData.set("model", model);
      formData.set("importMode", "composite-auto");
      if (cleanScreenshotUi) formData.set("cleanScreenshotUi", "on");
      compositeFiles.forEach((file) => formData.append("compositeImages", file));
      formData.set("sourceUrl", sourceUrl.trim());
      formData.set("sourceAuthor", sourceAuthor.trim());
      formData.set("rightsStatus", rightsStatus);
      formData.set("rawSourceText", rawText.trim());
      formData.set("submitIntent", intent);

      const response = await fetch("/api/admin/templates", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "导入失败");
      setSaved(true);
      setTimeout(() => {
        router.push(intent === "published" ? `/templates/${encodeURIComponent(payload.slug)}` : "/admin");
        router.refresh();
      }, 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="quick-import-form">
      <div className="admin-page-header quick-import-header">
        <div>
          <span className="admin-kicker">ONE-CLICK TEMPLATE PUBLISHER</span>
          <h1>一键发布风格模板</h1>
          <p>粘贴原始文案后由 AI 提炼双语公开信息和固定提示词，再由你审核、配图并发布。</p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-secondary" type="button" disabled={saving || organizing} onClick={() => submit("draft")}>
            <Save /> 保存草稿
          </button>
          <button className="admin-primary" type="button" disabled={saving || organizing || rightsStatus === "reference_only"} onClick={() => submit("published")}>
            {saving ? <LoaderCircle className="spin" /> : <UploadCloud />} {saving ? "正在拆图并发布…" : "一键整理并发布"}
          </button>
        </div>
      </div>

      {error && <div className="admin-alert error">{error}</div>}
      {saved && <div className="admin-alert success"><Check /> 已保存，正在返回模板列表…</div>}

      <div className="quick-import-layout">
        <div className="quick-import-main">
          <section className="paste-capture-card" tabIndex={0} onPaste={handlePaste}>
            <ClipboardPaste />
            <div>
              <strong>点击这里，然后按 Ctrl + V</strong>
              <p>可一次粘贴提示词、分享链接和多张上下分割效果图；最多处理 8 张。</p>
            </div>
            <span>PASTE</span>
          </section>

          <section className="admin-form-section import-source-section">
            <div className="section-heading"><h2>01 · 来源记录</h2><p>这些信息只在后台可见，不会发送给普通用户。</p></div>
            <div className="admin-field-grid two">
              <label><span><Link2 /> 来源链接</span><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="粘贴小红书分享链接" /></label>
              <label><span>来源账号</span><input value={sourceAuthor} onChange={(event) => setSourceAuthor(event.target.value)} placeholder="作者昵称或小红书号" /></label>
            </div>
            <label className="admin-field"><span>原始笔记文字</span><textarea rows={7} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="粘贴完整笔记正文或提示词…" /></label>
            <div className="organize-actions">
              <button className="auto-organize-button" type="button" disabled={organizing || saving} onClick={organizeWithAI}>
                {organizing ? <LoaderCircle className="spin" /> : <Sparkles />} {organizing ? "AI 正在按顺序尝试模型…" : "AI 智能整理"}
              </button>
              <button className="admin-secondary" type="button" disabled={organizing || saving} onClick={() => applyRuleText(rawText)}>规则整理</button>
            </div>
            {organizerModel && (
              <div className="organizer-result">
                <strong>{organizerModel === "规则引擎" ? "已使用本地规则生成草稿" : `AI 草稿已由 ${organizerModel} 生成`}</strong>
                {organizerAttempts.length > 0 && <p>{organizerAttempts.map((attempt) => `${attempt.model}：${attempt.status === "succeeded" ? "成功" : "失败"}`).join(" → ")}</p>}
                <p>所有结果仅填入可编辑草稿，不会自动发布。</p>
              </div>
            )}
            {!organizerModel && organizerAttempts.length > 0 && (
              <div className="organizer-result organizer-result-failed">
                <strong>三个模型均未完成整理</strong>
                <p>{organizerAttempts.map((attempt) => `${attempt.model}：失败`).join(" → ")}</p>
                <p>原文和已编辑内容未被覆盖，可稍后重试或使用规则整理。</p>
              </div>
            )}
            {organizerWarnings.length > 0 && <div className="admin-alert warning">{organizerWarnings.join("；")}</div>}
          </section>

          <section className="admin-form-section">
            <div className="section-heading"><h2>02 · 上传上下对照图</h2><p>系统自动识别水平分割线，并生成原图、纯风格效果图和首页拼接封面。</p></div>
            <label className="composite-upload-dropzone">
              <Images />
              <span><strong>选择多张上下分割效果图</strong><small>JPG / PNG / WebP · 单张不超过 20MB · 最多 8 张</small></span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => assignImages(Array.from(event.target.files ?? []))}
              />
            </label>
            {compositeFiles.length > 0 && (
              <div className="composite-preview-grid">
                {compositeFiles.map((file, index) => (
                  <article key={`${file.name}-${file.lastModified}-${file.size}-${index}`}>
                    <LocalImagePreview file={file} alt={`上下对照图 ${index + 1}`} />
                    <span><b>案例 {String(index + 1).padStart(2, "0")}</b><small>{file.name}</small></span>
                    <button type="button" aria-label={`删除案例 ${index + 1}`} onClick={() => setCompositeFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button>
                  </article>
                ))}
              </div>
            )}
            <label className="screenshot-cleanup-toggle">
              <input type="checkbox" checked={cleanScreenshotUi} onChange={(event) => setCleanScreenshotUi(event.target.checked)} />
              <Scissors />
              <span><strong>自动清理截图界面</strong><small>适用于带左右轮播箭头、右上页码和底部分页圆点的小红书截图；上传无界面原图时可关闭。</small></span>
            </label>
            <div className="auto-processing-flow">
              <span><b>01</b> 自动找分割线</span>
              <span><b>02</b> 拆出原图与风格图</span>
              <span><b>03</b> 拼接图作为首页封面</span>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="section-heading"><h2>03 · 自动整理结果</h2><p>系统已把对照式提示词改为“只生成最终风格图”，你仍可在发布前微调。</p></div>
            <div className="admin-field-grid two">
              <label><span>模板名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label><span>分类</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            </div>
            <label className="admin-field"><span>一句话介绍</span><input value={tagline} onChange={(event) => setTagline(event.target.value)} /></label>
            <label className="admin-field"><span>详细说明</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="admin-field"><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="复古, 人像, 手绘" /></label>
            <fieldset className="admin-checkbox-group horizontal">
              <legend>允许用户提供的内容</legend>
              <label><input type="checkbox" checked={allowText} onChange={(event) => setAllowText(event.target.checked)} /><span><strong>文字描述</strong><small>补充主体、场景和细节</small></span></label>
              <label><input type="checkbox" checked={allowImage} onChange={(event) => setAllowImage(event.target.checked)} /><span><strong>参考图片</strong><small>提供人物、物体或构图参考</small></span></label>
            </fieldset>
            <label className="admin-field"><span>文字输入提示</span><input value={textPlaceholder} onChange={(event) => setTextPlaceholder(event.target.value)} /></label>
            <label className="admin-field"><span>固定私有提示词 · 已锁定只生成风格图</span><textarea rows={12} value={privatePrompt} onChange={(event) => setPrivatePrompt(event.target.value)} /></label>
            <label className="admin-field"><span>负面提示词</span><textarea rows={3} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /></label>
            <div className="section-heading bilingual-heading"><h2>英文公开信息</h2><p>AI 可先生成英文草稿，后续双语前台可直接使用；留空也不影响当前中文版发布。</p></div>
            <div className="admin-field-grid two">
              <label><span>English name</span><input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label>
              <label><span>English category</span><input value={categoryEn} onChange={(event) => setCategoryEn(event.target.value)} /></label>
            </div>
            <label className="admin-field"><span>English tagline</span><input value={taglineEn} onChange={(event) => setTaglineEn(event.target.value)} /></label>
            <label className="admin-field"><span>English description</span><textarea rows={3} value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} /></label>
            <label className="admin-field"><span>English tags</span><input value={tagsEn} onChange={(event) => setTagsEn(event.target.value)} placeholder="vintage, portrait, illustration" /></label>
            <label className="admin-field"><span>English input placeholder</span><input value={textPlaceholderEn} onChange={(event) => setTextPlaceholderEn(event.target.value)} /></label>
          </section>
        </div>

        <aside className="quick-import-side">
          <section className="admin-form-section quick-import-settings">
            <div className="section-heading"><h2>发布检查</h2><p>确认素材权利后，点击一次即可处理并上线。</p></div>
            <label className="admin-field"><span>素材状态</span><select value={rightsStatus} onChange={(event) => setRightsStatus(event.target.value as RightsStatus)}><option value="reference_only">仅供内部参考</option><option value="authorized">已获得作者授权</option><option value="self_created">自有图片与案例</option></select></label>
            <div className={`rights-notice ${rightsStatus}`}><ShieldCheck /><p>{rightsStatus === "reference_only" ? "只能保存为草稿。请换成自己的案例图或获得授权后再发布。" : "可以发布，但仍建议保留来源与授权记录。"}</p></div>
            <label className="admin-field"><span>固定比例</span><select value={outputRatio} onChange={(event) => {
              const ratio = event.target.value;
              setOutputRatio(ratio);
              setOutputSize(resolveBoxAIHighImageSize(ratio));
            }}>{BOXAI_RATIOS.map((ratio) => <option value={ratio} key={ratio}>{ratio}</option>)}</select></label>
            <label className="admin-field"><span>输出尺寸</span><select value={outputSize} onChange={(event) => setOutputSize(event.target.value)}>{BOXAI_SIZE_PRESETS[outputRatio].map((preset) => <option key={preset.value} value={preset.value}>{preset.label} · {preset.tier}</option>)}</select><small>默认使用高清档；超清耗时和成本通常更高。</small></label>
            <label className="admin-field"><span>生成模型</span><select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-image-2.5-flare">gpt-image-2.5-flare</option><option value="gpt-image-2.5-sunburst">gpt-image-2.5-sunburst</option></select><small>模型按模板固定，不会在两个模型之间随机切换。</small></label>
            <div className="quick-import-tip"><strong>平台固定处理规则</strong><p>首页显示拼接封面；详情页分别显示原图和纯风格图；用户生成结果永远只包含最终风格作品。私有提示词会在服务端再次校验和加锁。</p></div>
          </section>
        </aside>
      </div>
    </form>
  );
}
