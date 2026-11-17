import Link from "next/link";
import { ArrowRight, Banknote, Clock3, FilePlus2, Images, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

import { CreatorProfileForm } from "@/components/creator-profile-form";
import { CreatorShell } from "@/components/creator-shell";
import { getCreatorDashboard } from "@/lib/creator-store";
import { getAllTemplates } from "@/lib/template-store";
import { requireUserPage } from "@/lib/user-page-auth";

function money(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

const statusLabels: Record<string, string> = {
  pending_review: "待审核",
  published: "已发布",
  rejected: "已驳回",
  suspended: "已暂停",
};

export default async function CreatorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUserPage("/creator");
  const [dashboard, templates, params] = await Promise.all([
    getCreatorDashboard(user.id),
    getAllTemplates(),
    searchParams,
  ]);
  const owned = templates.filter((item) => item.ownerType === "creator" && item.ownerUserId === user.id);

  if (!dashboard.profile) {
    return (
      <CreatorShell>
        <section className="creator-welcome">
          <div className="creator-welcome-copy"><span className="creator-kicker">CREATE · SHARE · EARN</span><h1>把你的风格配方，<br />变成持续被使用的作品。</h1><p>上传私有提示词和对照案例，管理员审核发布。其他用户成功使用后，你将按每张 ¥0.20 获得收益。</p></div>
          <div className="creator-welcome-rules"><article><Sparkles /><strong>一键整理</strong><p>自动拆分上下对照图，并把提示词整理为只生成最终风格图。</p></article><article><ShieldCheck /><strong>提示词私有</strong><p>提示词只在服务端用于生成，普通用户无法查看。</p></article><article><Banknote /><strong>成功才计收益</strong><p>作品交付且次数核销成功后记账，7 天后转为可提现。</p></article></div>
          <div className="creator-onboarding-card"><span>CREATOR PROFILE</span><h2>先建立你的创作者名片</h2><CreatorProfileForm /></div>
        </section>
      </CreatorShell>
    );
  }

  return (
    <CreatorShell active="home">
      <header className="creator-page-header"><div><span className="creator-kicker">CREATOR DESK</span><h1>你好，{dashboard.profile.displayName}</h1><p>{dashboard.profile.bio || "把独特风格整理成人人都能使用的创作模板。"}</p></div><Link href="/creator/templates/new" className="creator-primary-button"><FilePlus2 /> 投稿新模板</Link></header>
      {params.submitted === "1" && <div className="creator-banner success">模板已经提交审核。审核通过前不会在模板库公开。</div>}
      <section className="creator-stat-grid">
        <article><span><Clock3 /> 待结算收益</span><strong>{money(dashboard.balances.pendingFen)}</strong><small>生成成功后保护 7 天</small></article>
        <article><span><Banknote /> 可提现收益</span><strong>{money(dashboard.balances.availableFen)}</strong><small>可兑换次数或申请提现</small></article>
        <article><span><WalletCards /> 平台奖励次数</span><strong>{dashboard.balances.rewardCredits}</strong><small>创作时优先使用</small></article>
        <article><span><Images /> 已发布模板</span><strong>{owned.filter((item) => item.status === "published").length}</strong><small>共投稿 {owned.length} 个</small></article>
      </section>
      <section className="creator-panel">
        <div className="creator-panel-heading"><div><span>YOUR RECIPES</span><h2>我的模板</h2></div><Link href="/creator/templates/new">继续投稿 <ArrowRight /></Link></div>
        {owned.length ? (
          <div className="creator-template-list">
            {owned.map((template) => (
              <article key={template.id}>
                {/* Creator-managed images have dynamic dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.coverImage} alt="" />
                <div>
                  <span className={`creator-status ${template.status}`}>{statusLabels[template.status] || template.status}</span>
                  <h3>{template.name}</h3>
                  <p>{template.tagline}</p>
                  {template.reviewReason && <small>审核意见：{template.reviewReason}</small>}
                </div>
                {template.status === "published" && <Link href={`/templates/${template.slug}`}>查看 <ArrowRight /></Link>}
              </article>
            ))}
          </div>
        ) : (
          <div className="creator-empty"><Images /><h3>还没有投稿模板</h3><p>准备好提示词和上下对照图，就可以一键送审。</p><Link href="/creator/templates/new">开始第一次投稿</Link></div>
        )}
      </section>
    </CreatorShell>
  );
}
