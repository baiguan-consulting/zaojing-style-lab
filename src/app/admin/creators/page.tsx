import { Banknote, Clock3, Images, ShieldCheck } from "lucide-react";

import { TemplateReviewActions, WithdrawalReviewActions } from "@/components/admin-creator-actions";
import { AdminShell } from "@/components/admin-shell";
import { listCreatorWithdrawalsForAdmin } from "@/lib/creator-store";
import { getAllTemplates } from "@/lib/template-store";

function money(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

const withdrawalLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过待付款",
  PAID: "已付款",
  REJECTED: "已驳回",
};

export default async function AdminCreatorsPage() {
  const [templates, withdrawals] = await Promise.all([
    getAllTemplates(),
    listCreatorWithdrawalsForAdmin(),
  ]);
  const creatorTemplates = templates.filter((item) => item.ownerType === "creator");
  const pending = creatorTemplates.filter((item) => item.status === "pending_review");

  return (
    <AdminShell active="creators">
      <div className="admin-page-header">
        <div>
          <span className="admin-kicker">CREATOR OPERATIONS</span>
          <h1>创作者审核</h1>
          <p>审核模板权利与质量，处理人工支付宝提现。</p>
        </div>
      </div>

      <section className="admin-stats">
        <article><span><Clock3 /> 待审核模板</span><strong>{pending.length}</strong><small>审核前不会公开</small></article>
        <article><span><Images /> 创作者模板</span><strong>{creatorTemplates.length}</strong><small>含已发布与已驳回</small></article>
        <article><span><Banknote /> 待审核提现</span><strong>{withdrawals.filter((item) => item.status === "PENDING").length}</strong><small>提交时已冻结收益</small></article>
        <article><span><ShieldCheck /> 收益保护期</span><strong>7 天</strong><small>成功生成后开始计算</small></article>
      </section>

      <section className="admin-creator-section">
        <div className="section-heading">
          <h2>待审核模板</h2>
          <p>请检查案例拆分、提示词转换和素材权利声明。</p>
        </div>
        {pending.length ? (
          <div className="admin-review-grid">
            {pending.map((template) => (
              <article key={template.id}>
                {/* Creator-managed images have dynamic dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.coverImage} alt="" />
                <div>
                  <span>{template.creatorName || "创作者"}</span>
                  <h3>{template.name}</h3>
                  <p>{template.tagline}</p>
                  <small>{template.examples.length} 组案例 · {template.outputRatio} · 奖励 {money(template.creatorRewardFen || 0)}/张</small>
                  <div className="admin-review-links"><a href={`/admin/templates/${template.id}/edit`}>查看并编辑完整内容</a></div>
                  <TemplateReviewActions templateId={template.id} />
                </div>
              </article>
            ))}
          </div>
        ) : <div className="admin-empty-state">当前没有待审核模板</div>}
      </section>

      <section className="admin-creator-section">
        <div className="section-heading">
          <h2>人工提现申请</h2>
          <p>收款信息已加密保存，仅在管理员页面解密显示。请线下支付宝转账后登记单号。</p>
        </div>
        {withdrawals.length ? (
          <div className="admin-withdrawal-list">
            {withdrawals.map((item) => (
              <article key={item.id}>
                <div>
                  <span className={`withdrawal-status ${item.status.toLowerCase()}`}>{withdrawalLabels[item.status] || item.status}</span>
                  <h3>{item.creatorName} · {money(item.amountFen)}</h3>
                  <p>支付宝实名：{item.payeeName}　账号：{item.alipayAccount}</p>
                  <small>登录邮箱：{item.email} · 联系邮箱：{item.contactEmail} · {new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</small>
                  {item.transferReference && <small>转账记录：{item.transferReference}</small>}
                  {item.reviewNote && <small>审核备注：{item.reviewNote}</small>}
                </div>
                <WithdrawalReviewActions withdrawalId={item.id} status={item.status} />
              </article>
            ))}
          </div>
        ) : <div className="admin-empty-state">当前没有提现申请</div>}
      </section>
    </AdminShell>
  );
}
