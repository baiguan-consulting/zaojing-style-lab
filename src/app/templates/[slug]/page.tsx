import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ImagePlus, Ratio, Sparkles } from "lucide-react";

import { CreatePanel } from "@/components/create-panel";
import { ExampleGallery } from "@/components/example-gallery";
import { SiteHeader } from "@/components/site-header";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import { localizeTemplate } from "@/lib/template-localization";
import { getPublicTemplateBySlug } from "@/lib/template-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const storedTemplate = await getPublicTemplateBySlug(slug);
  if (!storedTemplate) return {};

  const template = localizeTemplate(storedTemplate, locale);
  const route = `/templates/${template.slug}`;
  return {
    title: `${template.name} · ${locale === "en" ? "Zaojing Style Lab" : "造境 Style Lab"}`,
    description: template.tagline || template.description,
    alternates: {
      canonical: localizedPath(locale, route),
      languages: {
        "zh-CN": localizedPath("zh", route),
        en: localizedPath("en", route),
        "x-default": localizedPath("zh", route),
      },
    },
    openGraph: {
      title: template.name,
      description: template.tagline || template.description,
      images: [template.examples[0]?.outputImage ?? template.coverImage],
      locale: locale === "en" ? "en_US" : "zh_CN",
      type: "website",
    },
  };
}

export default async function TemplateDetailPage({ params }: PageProps<"/templates/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const english = locale === "en";
  const storedTemplate = await getPublicTemplateBySlug(slug);
  if (!storedTemplate) notFound();
  const template = localizeTemplate(storedTemplate, locale);

  return (
    <main>
      <SiteHeader />
      <div className="detail-shell">
        <Link href={localizedPath(locale, "/#templates")} className="back-link"><ArrowLeft size={16} /> {english ? "Back to styles" : "返回模板库"}</Link>
        <section className="detail-intro">
          <div>
            <span className="eyebrow">{template.category} · {template.outputRatio}</span>
            <h1>{template.name}</h1>
            {template.ownerType === "creator" && template.creatorName && <span className="detail-creator">{english ? "Creator" : "风格创作者"} · {template.creatorName}</span>}
            <p className="detail-tagline">{template.tagline}</p>
          </div>
          <p className="detail-description">{template.description}</p>
        </section>

        <ExampleGallery examples={template.examples} name={template.name} locale={locale} />

        <section className="recipe-notes">
          <article><Sparkles /><span><small>STYLE LOCKED</small><strong>{english ? "Style, already tuned" : "风格已经调好"}</strong><p>{english ? "The hidden prompt and model settings stay fixed, so your input cannot overwrite the style." : "隐藏提示词与模型参数由模板固定，用户内容不会覆盖风格。"}</p></span></article>
          <article><ImagePlus /><span><small>INPUT</small><strong>{english ? "Bring your content" : "提供你的内容"}</strong><p>{template.allowText && template.allowImage ? (english ? "Use text, an image, or both together." : "可输入文字、上传图片，或两者同时提供。") : template.allowImage ? (english ? "Upload the image you want to transform." : "上传一张你希望处理的图片。") : (english ? "Describe the subject and scene you want to create." : "输入你希望生成的主体和场景。")}</p></span></article>
          <article><Ratio /><span><small>OUTPUT</small><strong>{template.outputRatio} · {template.outputSize}</strong><p>{english ? "The ratio and resolution are fixed. No technical settings required." : "输出比例和清晰度固定，不需要理解复杂参数。"}</p></span></article>
          <article><Clock3 /><span><small>PRIVACY</small><strong>{english ? "Deleted after 24 hours" : "仅保存 24 小时"}</strong><p>{english ? "Uploads and results are permanently deleted. Download your work in time." : "原图与结果到期永久删除，请用户及时下载。"}</p></span></article>
        </section>

        <section className="creation-section">
          <div className="creation-side-copy">
            <span className="eyebrow">YOUR TURN</span>
            <h2>{english ? <>Now make it<br />your scene.</> : <>现在，换成<br />你的画面。</>}</h2>
            <ul>
              <li><CheckCircle2 /> {english ? "Provide text, an image, or both" : "至少提供文字或图片中的一种"}</li>
              <li><CheckCircle2 /> {english ? "The curated style always stays in control" : "模板规则优先于用户补充内容"}</li>
              <li><CheckCircle2 /> {english ? "Create one or two images" : "可选择生成 1 张或 2 张"}</li>
              <li><CheckCircle2 /> {english ? "Download within 24 hours" : "完成后请在 24 小时内下载"}</li>
            </ul>
          </div>
          <CreatePanel template={template} locale={locale} />
        </section>
      </div>
    </main>
  );
}
