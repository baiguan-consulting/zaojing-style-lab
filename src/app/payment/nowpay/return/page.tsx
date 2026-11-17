import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { AUTH_SESSION_COOKIE, authenticateSessionToken } from "@/lib/auth";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import { queryNowPayQuota } from "@/lib/nowpay-direct";
import {
  getNowPayPurchaseForUser,
  updateNowPayPurchaseRequest,
} from "@/lib/nowpay-store";

export const dynamic = "force-dynamic";

export default async function NowPayReturnPage(props: PageProps<"/payment/nowpay/return">) {
  const params = await props.searchParams;
  const locale = await getLocale();
  const english = locale === "en";
  const purchaseId = typeof params.purchaseId === "string" ? params.purchaseId : "";
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  const user = await authenticateSessionToken(token);
  if (!user) {
    const returnPath = localizedPath(locale, `/payment/nowpay/return?purchaseId=${purchaseId}`);
    redirect(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(returnPath)}`);
  }

  const purchase = purchaseId ? await getNowPayPurchaseForUser(purchaseId, user.id) : undefined;
  let remaining: number | undefined;
  let refreshed = false;
  if (purchase) {
    await updateNowPayPurchaseRequest(purchase.id, { status: "RETURNED", returnedAt: new Date() });
    try {
      const quota = await queryNowPayQuota(user.id);
      remaining = quota.remaining;
      refreshed = true;
      if (purchase.remainingBefore !== null && quota.remaining > purchase.remainingBefore) {
        await updateNowPayPurchaseRequest(purchase.id, { status: "QUOTA_CONFIRMED", completedAt: new Date() });
      }
    } catch {
      refreshed = false;
    }
  }

  return (
    <main>
      <SiteHeader />
      <div className="payment-return-shell">
        <section className="payment-return-card">
          {purchase && refreshed ? (
            <>
              <span className="payment-state-icon success"><Check /></span>
              <small>QUOTA REFRESHED</small>
              <h1>{english ? "Your credits are updated" : "创作次数已刷新"}</h1>
              <p>{english ? `Your account now has ${remaining} credits. The Alipay hosted page and verified balance are the final reference.` : `当前账户可用 ${remaining} 次。最终购买结果以支付宝托管购买页和即刻收余额查询为准。`}</p>
            </>
          ) : (
            <>
              <span className="payment-state-icon warning"><CircleAlert /></span>
              <small>QUOTA NEEDS CHECK</small>
              <h1>{english ? "Confirming your credits" : "次数正在确认"}</h1>
              <p>{english ? "We could not refresh the balance yet. If Alipay completed the payment, do not pay again. Return to the credits page shortly and refresh." : "暂时未能刷新即刻收余额。如果支付宝已完成付款，请不要重复购买，稍后回到账户页刷新。"}</p>
            </>
          )}
          <div className="payment-return-actions">
            <Link className="primary-button" href={localizedPath(locale, "/credits")}>{english ? "View credits" : "查看创作次数"}</Link>
            <Link className="secondary-button" href={localizedPath(locale, "/#templates")}>{english ? "Back to styles" : "返回模板库"}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
