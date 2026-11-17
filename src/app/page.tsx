import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowRight, Clock3, Image as ImageIcon, MousePointer2, Sparkles } from "lucide-react";

import { AdminPortalLink } from "@/components/admin-portal-link";
import { Catalog } from "@/components/catalog";
import { SiteHeader } from "@/components/site-header";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import { localizeTemplates } from "@/lib/template-localization";
import { getPublishedTemplates } from "@/lib/template-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const english = locale === "en";
  return {
    title: english
      ? "Zaojing Style Lab · Choose a style, create your image"
      : "造境 Style Lab · 选择风格，生成你的图片",
    description: english
      ? "Choose a curated visual style, upload an image or describe your scene, and create in one step."
      : "选择已经调好的图片风格模板，上传图片或描述画面，一键生成同款效果。",
    alternates: {
      canonical: english ? "/en" : "/",
      languages: { "zh-CN": "/", en: "/en", "x-default": "/" },
    },
  };
}

export default async function Home() {
  const locale = await getLocale();
  const english = locale === "en";
  const templates = localizeTemplates(await getPublishedTemplates(), locale);
  const featured = templates.find((template) => template.isFeatured) ?? templates[0];
  const featuredImage = featured?.examples[0]?.outputImage ?? featured?.coverImage;

  return (
    <main>
      <SiteHeader />
      <section className="hero-shell">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> {english ? "PROMPT-FREE CREATION" : "PROMPT-FREE CREATION · 零门槛创作"}</span>
          <h1>{english ? <>Skip the prompt.<br />Create something<span> unmistakably yours.</span></> : <>不写提示词，<br />也能做出<span>你的那一张。</span></>}</h1>
          <p>{english ? "Choose a style, then upload an image or describe your scene." : "挑一个喜欢的风格，上传图片或描述画面。"}</p>
          <div className="hero-actions">
            <Link href={localizedPath(locale, "/#templates")} className="primary-button">{english ? "Explore all styles" : "浏览全部模板"} <ArrowDown size={18} /></Link>
            <span><Clock3 size={17} /> {english ? "All images expire after 24 hours" : "所有图片仅保留 24 小时"}</span>
          </div>
          <div className="hero-steps">
            <span><b>01</b><MousePointer2 /> {english ? "Choose a style" : "选择风格"}</span>
            <span><b>02</b><ImageIcon /> {english ? "Add your content" : "提供内容"}</span>
            <span><b>03</b><Sparkles /> {english ? "Create & download" : "生成下载"}</span>
          </div>
        </div>

        {featured && (
          <Link href={localizedPath(locale, `/templates/${featured.slug}`)} className="hero-feature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featuredImage} alt={english ? `${featured.name} result` : `${featured.name}生成效果`} />
            <div className="hero-feature-caption">
              <span>{english ? "FEATURED STYLE · THIS WEEK" : "FEATURED STYLE · 本周精选"}</span>
              <strong>{featured.name}</strong>
              <p>{featured.tagline}</p>
              <i><ArrowRight size={19} /></i>
            </div>
          </Link>
        )}
      </section>

      <Catalog key={locale} templates={templates} locale={locale} />

      <section className="trust-strip">
        <span>PRIVATE BY DEFAULT</span>
        <h2>{english ? "Keep the idea. Not the image." : "灵感留下，图片不留。"}</h2>
        <p>{english ? "Uploads and generated images are automatically deleted after 24 hours. Your work belongs to you, so download it before the timer ends." : "上传素材与生成结果在 24 小时后自动删除。作品只属于你，请在倒计时结束前下载保存。"}</p>
      </section>

      <footer className="site-footer">
        <div className="brand"><span className="brand-mark">造</span><strong>造境 STYLE LAB</strong></div>
        <p>{english ? "Curated styles. More predictable results." : "用确定的模板，得到更确定的结果。"}</p>
        <Suspense fallback={null}>
          <AdminPortalLink>{english ? "Open admin" : "进入管理后台"} <ArrowRight size={16} /></AdminPortalLink>
        </Suspense>
      </footer>
    </main>
  );
}
