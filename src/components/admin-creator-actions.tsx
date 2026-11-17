"use client";

import { Check, LoaderCircle, ShieldX, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TemplateReviewActions({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("请填写驳回原因")?.trim() : "";
    if (action === "reject" && !reason) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/creator/templates/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "审核失败");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "审核失败");
    } finally {
      setLoading(false);
    }
  }
  return <div className="admin-creator-buttons">{error && <small>{error}</small>}<button onClick={() => act("approve")} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Check />} 通过并发布</button><button className="reject" onClick={() => act("reject")} disabled={loading}><ShieldX /> 驳回</button></div>;
}

export function WithdrawalReviewActions({ withdrawalId, status }: { withdrawalId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function act(action: "approve" | "paid" | "reject") {
    const note = action === "reject" ? window.prompt("请填写驳回原因")?.trim() : "";
    const transferReference = action === "paid" ? window.prompt("请输入支付宝转账单号或转账备注")?.trim() : "";
    if (action === "reject" && !note) return;
    if (action === "paid" && !transferReference) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/creator/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note, transferReference }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "处理失败");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "处理失败");
    } finally {
      setLoading(false);
    }
  }
  return <div className="admin-creator-buttons">{error && <small>{error}</small>}{status === "PENDING" && <button onClick={() => act("approve")} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Check />} 审核通过</button>}{status === "APPROVED" && <button onClick={() => act("paid")} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <WalletCards />} 登记已付款</button>}{["PENDING", "APPROVED"].includes(status) && <button className="reject" onClick={() => act("reject")} disabled={loading}><ShieldX /> 驳回</button>}</div>;
}
