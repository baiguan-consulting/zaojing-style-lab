import { Banknote, Clock3, WalletCards } from "lucide-react";

import { CreatorFinanceActions } from "@/components/creator-finance-actions";
import { CreatorShell } from "@/components/creator-shell";
import { getCreatorDashboard } from "@/lib/creator-store";
import { requireUserPage } from "@/lib/user-page-auth";

function money(fen: number) { return `¥${(fen / 100).toFixed(2)}`; }
const withdrawalLabels: Record<string, string> = { PENDING: "待审核", APPROVED: "待付款", PAID: "已付款", REJECTED: "已驳回" };
const ledgerLabels: Record<string, string> = { GENERATION_REWARD: "模板使用奖励", CONVERSION_DEBIT: "兑换创作次数", WITHDRAWAL_RESERVE: "提现冻结", WITHDRAWAL_RELEASE: "提现退回", ADJUSTMENT: "人工调整" };

export default async function CreatorEarningsPage() {
  const user = await requireUserPage("/creator/earnings");
  const dashboard = await getCreatorDashboard(user.id);
  return <CreatorShell active="earnings"><header className="creator-page-header"><div><span className="creator-kicker">EARNINGS LEDGER</span><h1>收益与提现</h1><p>每一笔奖励、兑换和提现都保留独立账务流水。</p></div></header>{!dashboard.profile ? <div className="creator-banner">请先在创作者中心开通创作者资料。</div> : <><section className="creator-stat-grid"><article><span><Clock3 /> 待结算</span><strong>{money(dashboard.balances.pendingFen)}</strong><small>7 天后自动转为可用</small></article><article><span><Banknote /> 可用收益</span><strong>{money(dashboard.balances.availableFen)}</strong><small>当前可兑换或提现</small></article><article><span><WalletCards /> 平台奖励次数</span><strong>{dashboard.balances.rewardCredits}</strong><small>优先用于下一次创作</small></article><article><span><Banknote /> 提现中 / 已提现</span><strong>{money(dashboard.balances.processingFen)}</strong><small>累计已提现 {money(dashboard.balances.paidFen)}</small></article></section><CreatorFinanceActions availableFen={dashboard.balances.availableFen} defaultEmail={user.email} /><section className="creator-ledger-layout"><div className="creator-panel"><div className="creator-panel-heading"><div><span>LEDGER</span><h2>最近收益流水</h2></div></div>{dashboard.ledger.length ? <div className="creator-ledger-list">{dashboard.ledger.map((item) => <article key={item.id}><div><strong>{ledgerLabels[item.type] || item.type}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</small></div><span className={item.deltaFen >= 0 ? "positive" : "negative"}>{item.deltaFen >= 0 ? "+" : "-"}{money(Math.abs(item.deltaFen))}</span></article>)}</div> : <div className="creator-empty compact">暂无收益流水</div>}</div><div className="creator-panel"><div className="creator-panel-heading"><div><span>WITHDRAWALS</span><h2>提现记录</h2></div></div>{dashboard.withdrawals.length ? <div className="creator-ledger-list">{dashboard.withdrawals.map((item) => <article key={item.id}><div><strong>{withdrawalLabels[item.status] || item.status}</strong><small>{item.alipayAccount} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}</small></div><span>{money(item.amountFen)}</span></article>)}</div> : <div className="creator-empty compact">暂无提现申请</div>}</div></section></>}</CreatorShell>;
}
