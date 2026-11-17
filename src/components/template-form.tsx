"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, Check, Eye, FileImage, KeyRound, LoaderCircle, LockKeyhole, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BOXAI_RATIOS,
  BOXAI_SIZE_PRESETS,
  normalizeSizeValue,
  resolveBoxAIHighImageSize,
} from "@/lib/image-sizes";
import type { StudioTemplate } from "@/lib/template-types";

type ExampleRow = {
  key: string;
  id?: string;
  inputImage?: string;
  outputImage?: string;
};

export function TemplateForm({ template }: { template?: StudioTemplate }) {
  const router = useRouter();
  const isEditing = Boolean(template);
  const [exampleRows, setExampleRows] = useState<ExampleRow[]>(
    template?.examples.map((example) => ({ key: example.id, ...example })) ?? [{ key: "new-0" }],
  );
  const [nextRow, setNextRow] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [outputRatio, setOutputRatio] = useState(template?.outputRatio ?? "3:4");

  const normalizedCurrentSize = normalizeSizeValue(template?.outputSize ?? "");
  const currentSizeIsValid = BOXAI_SIZE_PRESETS[outputRatio].some((preset) => preset.value === normalizedCurrentSize);
  const defaultOutputSize = currentSizeIsValid
    ? normalizedCurrentSize
    : resolveBoxAIHighImageSize(outputRatio);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const formData = new FormData(event.currentTarget);
      formData.set("submitIntent", submitter?.value ?? "published");
      const response = await fetch(
        isEditing ? `/api/admin/templates/${template?.id}` : "/api/admin/templates",
        { method: isEditing ? "PATCH" : "POST", body: formData },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "模板保存失败");
      setSaved(true);
      setTimeout(() => {
        router.push("/admin");
        router.refresh();
      }, 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模板保存失败");
    } finally {
      setSaving(false);
    }
  }

  function addExample() {
    setExampleRows((rows) => [...rows, { key: `new-${nextRow}` }]);
    setNextRow((value) => value + 1);
  }

  return (
    <form className="template-form" onSubmit={submit}>
      <div className="admin-page-header">
        <div>
          <Link href="/admin" className="back-link"><ArrowLeft /> 返回模板列表</Link>
          <span className="admin-kicker">{isEditing ? "EDIT STYLE RECIPE" : "NEW STYLE RECIPE"}</span>
          <h1>{isEditing ? `编辑「${template?.name}」` : "新建风格模板"}</h1>
          <p>{isEditing ? "修改公开展示、案例图片、隐藏提示词与固定输出规则。" : "一次录入公开案例、隐藏提示词与固定输出规则。"}</p>
        </div>
        <div className="admin-header-actions">
          <button type="submit" name="submitIntent" value="draft" className="admin-secondary" disabled={saving}><Save /> 保存为草稿</button>
          <button type="submit" name="submitIntent" value="published" className="admin-primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Eye />} 保存并发布
          </button>
        </div>
      </div>

      {error && <div className="admin-alert error">{error}</div>}
      {saved && <div className="admin-alert success"><Check /> 模板已保存，正在返回列表…</div>}

      <div className="form-layout">
        <div className="form-main-column">
          <section className="admin-form-section">
            <div className="section-number">01</div>
            <div className="section-heading"><h2>公开信息</h2><p>这些内容会出现在模板卡片和详情页。</p></div>
            <div className="admin-field-grid two">
              <label><span>模板名称 *</span><input name="name" required defaultValue={template?.name} placeholder="例如：复古旅行邮票" /></label>
              <label><span>英文标识</span><input name="slug" defaultValue={template?.slug} readOnly={isEditing} placeholder="vintage-travel-stamp" /><small>{isEditing ? "为避免旧链接失效，发布后不修改" : "不填则自动生成"}</small></label>
              <label><span>分类 *</span><input name="category" required defaultValue={template?.category} placeholder="旅行艺术" /></label>
              <label><span>标签</span><input name="tags" defaultValue={template?.tags.join(", ")} placeholder="复古, 邮票, 旅行, 手绘" /></label>
            </div>
            <label className="admin-field"><span>一句话介绍 *</span><input name="tagline" required defaultValue={template?.tagline} placeholder="把一段旅行记忆，收进手工邮票里" /></label>
            <label className="admin-field"><span>详细说明 *</span><textarea name="description" required rows={4} defaultValue={template?.description} placeholder="说明模板会产生怎样的效果、适合什么类型的素材…" /></label>
            {template?.coverImage && <div className="current-template-image"><span>当前首页封面</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.coverImage} alt="当前模板封面" />
            </div>}
            <label className="upload-card compact"><FileImage /><span><strong>{isEditing ? "替换模板封面" : "上传模板封面"}</strong><small>{isEditing ? "不选择文件则保留当前封面" : "可不传，系统将使用第一张效果图"}</small></span><input type="file" name="coverImage" accept="image/jpeg,image/png,image/webp" /></label>
          </section>

          <section className="admin-form-section">
            <div className="section-number">02</div>
            <div className="section-heading"><h2>原图与效果图</h2><p>已有图片可以保留、单独替换或整组删除；新案例必须同时上传两张图。</p></div>
            <div className="example-upload-list">
              {exampleRows.map((row, index) => (
                <div className="example-upload-row" key={row.key}>
                  <input type="hidden" name="exampleIds" value={row.id ?? row.key} />
                  <span className="example-number">案例 {String(index + 1).padStart(2, "0")}</span>
                  <label>
                    <small>BEFORE · 原图{row.inputImage ? "（不选则保留）" : ""}</small>
                    {row.inputImage && <span className="existing-example-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.inputImage} alt={`案例 ${index + 1} 原图`} />
                    </span>}
                    <input type="file" name={isEditing ? `exampleInput:${row.id ?? row.key}` : "exampleInputs"} required={!row.id} accept="image/jpeg,image/png,image/webp" />
                  </label>
                  <span className="example-arrow">→</span>
                  <label>
                    <small>AFTER · 效果图{row.outputImage ? "（不选则保留）" : ""}</small>
                    {row.outputImage && <span className="existing-example-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.outputImage} alt={`案例 ${index + 1} 效果图`} />
                    </span>}
                    <input type="file" name={isEditing ? `exampleOutput:${row.id ?? row.key}` : "exampleOutputs"} required={!row.id} accept="image/jpeg,image/png,image/webp" />
                  </label>
                  <button type="button" aria-label={`删除案例 ${index + 1}`} onClick={() => setExampleRows((rows) => rows.filter((item) => item.key !== row.key))}><Trash2 /></button>
                </div>
              ))}
            </div>
            <button type="button" className="add-example" onClick={addExample}><Plus /> 添加一组案例</button>
          </section>

          <section className="admin-form-section private-section">
            <div className="section-number">03</div>
            <div className="section-heading"><h2>私有生成配置</h2><p><LockKeyhole /> 仅保存在服务端，不进入公开页面和用户接口。</p></div>
            <label className="admin-field"><span>固定提示词 *</span><textarea name="privatePrompt" required rows={14} defaultValue={template?.privatePrompt} placeholder="粘贴完整的模板提示词。用户内容只会作为主体或场景补充…" /></label>
            <label className="admin-field"><span>负面提示词</span><textarea name="negativePrompt" rows={4} defaultValue={template?.negativePrompt} placeholder="水印、品牌标志、低清晰度…" /></label>
            <div className="prompt-rule"><KeyRound /><span><strong>模板优先原则</strong><small>后端会在用户内容之后再次声明模板规则，用户输入不能直接修改这段提示词。</small></span></div>
          </section>
        </div>

        <aside className="form-side-column">
          <section className="admin-form-section sticky-settings">
            <div className="section-number">04</div>
            <div className="section-heading"><h2>输入与输出</h2><p>用户只看到你允许的内容输入方式。</p></div>
            <fieldset className="admin-checkbox-group">
              <legend>允许用户提供</legend>
              <label><input type="checkbox" name="allowText" defaultChecked={template?.allowText ?? true} /><span><strong>文字描述</strong><small>用于补充主体与场景</small></span></label>
              <label><input type="checkbox" name="allowImage" defaultChecked={template?.allowImage ?? true} /><span><strong>上传图片</strong><small>作为内容或人物参考</small></span></label>
            </fieldset>
            <label className="admin-field"><span>文字输入提示</span><input name="textPlaceholder" defaultValue={template?.textPlaceholder ?? "描述画面主体、场景或希望保留的细节"} /></label>
            <div className="admin-field-grid two compact-grid">
              <label><span>固定比例</span><select name="outputRatio" value={outputRatio} onChange={(event) => setOutputRatio(event.target.value)}>{BOXAI_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}</select></label>
              <label><span>BoxAI 输出尺寸</span><select name="outputSize" defaultValue={defaultOutputSize} key={`${outputRatio}-${defaultOutputSize}`}>{BOXAI_SIZE_PRESETS[outputRatio].map((preset) => <option key={preset.value} value={preset.value}>{preset.label} · {preset.tier}</option>)}</select></label>
            </div>
            <fieldset className="admin-checkbox-group horizontal">
              <legend>允许生成数量</legend>
              <label><input type="checkbox" name="allowCount1" defaultChecked disabled /><span><strong>1 张</strong></span></label>
              <label><input type="checkbox" name="allowCount2" defaultChecked={template?.allowedCounts.includes(2) ?? true} /><span><strong>2 张</strong></span></label>
            </fieldset>
            <label className="admin-field"><span>每张消耗点数</span><input type="number" name="priceCredits" min="1" defaultValue={template?.priceCredits ?? 1} /></label>
            <hr />
            <label className="admin-field"><span>模型服务</span><select name="providerId" defaultValue={template?.providerId ?? "boxai"}><option value="boxai">BoxAI · you-box.com</option></select></label>
            <label className="admin-field"><span>模型名称</span><select name="model" defaultValue={template?.model ?? "gpt-image-2.5-flare"}><option value="gpt-image-2.5-flare">gpt-image-2.5-flare</option><option value="gpt-image-2.5-sunburst">gpt-image-2.5-sunburst</option></select></label>
            <label className="featured-switch"><input type="checkbox" name="isFeatured" defaultChecked={template?.isFeatured ?? false} /><span><strong>设为编辑精选</strong><small>出现在首页主视觉位置</small></span></label>
          </section>
        </aside>
      </div>
    </form>
  );
}
