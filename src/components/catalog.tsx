"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ImagePlus, Search, Sparkles } from "lucide-react";

import { localizedPath } from "@/lib/locale";
import type { PublicTemplate } from "@/lib/template-types";
import type { Locale } from "@/lib/locale";

type CatalogProps = {
  templates: PublicTemplate[];
  locale: Locale;
};

export function Catalog({ templates, locale }: CatalogProps) {
  const english = locale === "en";
  const allLabel = english ? "All" : "全部";
  const [category, setCategory] = useState(allLabel);
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => [allLabel, ...Array.from(new Set(templates.map((item) => item.category)))],
    [allLabel, templates],
  );

  const filtered = templates.filter((template) => {
    const categoryMatches = category === allLabel || template.category === category;
    const searchMatches = `${template.name}${template.tagline}${template.tags.join("")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return categoryMatches && searchMatches;
  });

  return (
    <section id="templates" className="catalog-section">
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">{english ? "CURATED STYLES" : "CURATED RECIPES · 精选模板"}</span>
          <h2>{english ? "See the result. Then make it yours." : "先挑效果，再开始创作"}</h2>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={english ? "Search styles, uses, or tags" : "搜索风格、用途或标签"}
          />
        </label>
      </div>

      <div className="category-row" aria-label={english ? "Style categories" : "模板分类"}>
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="template-grid">
        {filtered.map((template, index) => (
          <article className="template-card" key={template.id}>
            <Link href={localizedPath(locale, `/templates/${template.slug}`)} className="card-image-wrap">
              {/* User-managed images have dynamic dimensions, so native image sizing is intentional. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.coverImage} alt={english ? `${template.name} preview` : `${template.name}效果图`} />
              <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
              {template.isFeatured && <span className="featured-badge">{english ? "Featured" : "编辑精选"}</span>}
              <span className="view-overlay">
                {english ? "See before & after" : "查看前后对比"} <ArrowRight size={17} />
              </span>
            </Link>
            <div className="card-body">
              <div className="card-meta">
                <span>{template.category}</span>
                <span>{template.outputRatio}</span>
              </div>
              {template.ownerType === "creator" && template.creatorName && (
                <span className="creator-attribution">{english ? "Creator" : "风格创作者"} · {template.creatorName}</span>
              )}
              <Link href={localizedPath(locale, `/templates/${template.slug}`)}>
                <h3>{template.name}</h3>
              </Link>
              <p>{template.tagline}</p>
              <div className="card-footer">
                <span className="input-badges">
                  {template.allowImage && (
                    <span><ImagePlus size={14} /> {english ? "Image" : "图片"}</span>
                  )}
                  {template.allowText && (
                    <span><Sparkles size={14} /> {english ? "Text" : "文字"}</span>
                  )}
                </span>
                <Link href={localizedPath(locale, `/templates/${template.slug}`)} className="use-link">
                  {english ? "Use style" : "使用模板"} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <span>{english ? "No matching styles found" : "没有找到匹配的模板"}</span>
          <button type="button" onClick={() => { setQuery(""); setCategory(allLabel); }}>
            {english ? "Clear filters" : "清除筛选"}
          </button>
        </div>
      )}
    </section>
  );
}
