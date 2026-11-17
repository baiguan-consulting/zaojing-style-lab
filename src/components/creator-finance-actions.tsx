"use client";

import { ArrowRightLeft, Banknote, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

export function CreatorFinanceActions({
  availableFen,
  defaultEmail,
}: {
  availableFen: number;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const maxCredits = useMemo(() => Math.floor(availableFen / 50), [availableFen]);

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConverting(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/creator/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credits: Number(form.get("credits")), idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "兑换失败");
      setMessage(`已兑换 ${payload.credits} 次平台奖励次数`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "兑换失败");
    } finally {
      setConverting(false);
    }
  }

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setWithdrawing(true);
    setMessage("");
    setError("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/creator/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountYuan: Number(form.get("amountYuan")),
          payeeName: form.get("payeeName"),
          alipayAccount: form.get("alipayAccount"),
          contactEmail: form.get("contactEmail"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "提现申请失败");
      setMessage("提现申请已提交，管理员审核后将人工转账");
      formElement.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提现申请失败");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="creator-finance-actions">
      {message && <p className="creator-action-message success">{message}</p>}
      {error && <p className="creator-action-message error">{error}</p>}
      <form onSubmit={convert}>
        <div className="creator-action-title"><ArrowRightLeft /><span><strong>兑换创作次数</strong><small>¥0.50 收益 = 1 次平台奖励次数</small></span></div>
        <label><span>兑换次数</span><input type="number" name="credits" min={1} max={Math.max(1, maxCredits)} defaultValue={1} disabled={maxCredits < 1} /></label>
        <button type="submit" disabled={converting || maxCredits < 1}>{converting ? <LoaderCircle className="spin" /> : <ArrowRightLeft />} 立即兑换</button>
      </form>
      <form onSubmit={withdraw}>
        <div className="creator-action-title"><Banknote /><span><strong>申请人工提现</strong><small>最低 ¥50.00，提交后冻结对应收益</small></span></div>
        <div className="creator-action-grid">
          <label><span>提现金额（元）</span><input type="number" name="amountYuan" min={50} step="0.01" required /></label>
          <label><span>支付宝实名</span><input name="payeeName" maxLength={50} required /></label>
          <label><span>支付宝账号</span><input name="alipayAccount" maxLength={100} required /></label>
          <label><span>联系邮箱</span><input type="email" name="contactEmail" defaultValue={defaultEmail} required /></label>
        </div>
        <button type="submit" disabled={withdrawing || availableFen < 5000}>{withdrawing ? <LoaderCircle className="spin" /> : <Banknote />} 提交提现申请</button>
      </form>
    </div>
  );
}
