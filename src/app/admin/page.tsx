import Link from "next/link";
import { ArrowUpRight, Clock3, Eye, FileText, Image as ImageIcon, Inbox, Pencil, Plus, Sparkles } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { getAllTemplates } from "@/lib/template-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const templates = await getAllTemplates();
  const published = templates.filter((item) => item.status === "published").length;

  return (
    <AdminShell>
      <div className="admin-page-header">
        <div><span className="admin-kicker">TEMPLATE LIBRARY</span><h1>模板管理</h1><p>管理案例、私有提示词、输入方式和固定输出规格。</p></div>
        <div className="admin-header-actions">
          <Link href="/admin/templates/new" className="admin-secondary"><Plus /> 完整新建</Link>
          <Link href="/admin/import" className="admin-primary"><Inbox /> 一键发布模板</Link>
        </div>
      </div>

      <section className="admin-stats">
        <article><span><FileText /> 模板总数</span><strong>{templates.length}</strong><small>含草稿与已发布</small></article>
        <article><span><Eye /> 前台已发布</span><strong>{published}</strong><small>用户当前可见</small></article>
        <article><span><ImageIcon /> 案例图片</span><strong>{templates.reduce((sum, item) => sum + item.examples.length * 2, 0)}</strong><small>原图与效果图</small></article>
        <article><span><Clock3 /> 隐私保留期</span><strong>24h</strong><small>用户素材统一规则</small></article>
      </section>

      <section className="admin-template-list">
        <div className="list-header"><span>模板</span><span>输入方式</span><span>输出</span><span>模型</span><span>状态</span><span>操作</span></div>
        {templates.map((template) => (
          <article key={template.id}>
            <div className="admin-template-title">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.coverImage} alt="" />
              <span><strong>{template.name}</strong><small>{template.category} · {template.examples.length} 组案例</small></span>
            </div>
            <div className="admin-input-mode">
              {template.allowImage && <span>图片</span>}{template.allowText && <span>文字</span>}
            </div>
            <span>{template.outputRatio}<small>{template.outputSize} · {template.allowedCounts.join("/")} 张</small></span>
            <span className="model-cell"><Sparkles /> {template.model}</span>
            <span className={`status-badge ${template.status}`}>{template.status === "published" ? "已发布" : template.status === "pending_review" ? "待审核" : template.status === "rejected" ? "已驳回" : template.status === "suspended" ? "已暂停" : "草稿"}</span>
            <div className="admin-row-actions">
              {template.status === "published" && <Link href={`/templates/${encodeURIComponent(template.slug)}`} target="_blank" title="查看前台"><ArrowUpRight /></Link>}
              <Link className="admin-edit-link" href={`/admin/templates/${template.id}/edit`} title={`编辑${template.name}`}><Pencil /> 编辑</Link>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
