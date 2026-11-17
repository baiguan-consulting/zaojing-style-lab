import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { PaymentCheckoutActions } from "@/components/payment-checkout-actions";
import { SiteHeader } from "@/components/site-header";
import { AUTH_SESSION_COOKIE, authenticateSessionToken } from "@/lib/auth";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import { formatBeijingDateTime, orderStatusLabel } from "@/lib/payment-display";
import { formatYuan, getCreditPackage } from "@/lib/payment-packages";
import { getOrderForUser } from "@/lib/payment-store";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage(props: PageProps<"/credits/orders/[orderId]">) {
  const { orderId } = await props.params;
  const locale = await getLocale();
  const english = locale === "en";
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  const user = await authenticateSessionToken(token);
  if (!user) {
    const orderPath = localizedPath(locale, `/credits/orders/${orderId}`);
    redirect(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(orderPath)}`);
  }

  const order = await getOrderForUser(orderId, user.id);
  if (!order) notFound();

  const creditPackage = getCreditPackage(order.packageId);
  const canPay = order.status === "CREATED" || order.status === "PENDING_PAYMENT";
  const platformUrl = process.env.APP_BASE_URL?.trim() || "https://picture.baiguan-consulting.com";
  let platformHost = "picture.baiguan-consulting.com";
  try {
    platformHost = new URL(platformUrl).host;
  } catch {
    // Keep the production hostname visible if APP_BASE_URL is temporarily invalid.
  }

  return (
    <main className="order-detail-page">
      <SiteHeader />
      <div className="order-detail-shell">
        <Link href={localizedPath(locale, "/credits")} className="back-link order-detail-back"><ArrowLeft /> {english ? "Back to credits" : "返回创作次数"}</Link>

        <header className="order-detail-heading">
          <div>
            <span className="eyebrow">TRANSACTION ORDER</span>
            <h1>{english ? "Transaction details" : "交易订单详情"}</h1>
          </div>
          <p>{english ? "Review the account, item, and amount before paying. This page shows the order stored in the platform database." : "请在付款前核对账号、商品内容和金额。此页面展示平台数据库中的真实订单记录。"}</p>
        </header>

        <article className="transaction-receipt" aria-label={english ? "Zaojing transaction order" : "造境平台交易订单"}>
          <header className="receipt-brand-row">
            <div className="receipt-platform">
              <span className="receipt-brand-mark">造</span>
              <div>
                <strong>造境 Style Lab</strong>
                <span>{english ? "AI image style creation platform" : "AI 图片风格创作平台"}</span>
                <a href={platformUrl}>{platformHost}</a>
              </div>
            </div>
            <span className="receipt-status" data-status={order.status}>
              {orderStatusLabel(order.status, locale)}
            </span>
          </header>

          <div className="receipt-verification-note">
            <ShieldCheck />
            <span><strong>{english ? "Verified platform order" : "平台真实订单"}</strong>{english ? "Created by the signed-in account and stored in Zaojing's transaction system." : "订单信息由登录账号创建并保存在造境平台交易系统中。"}</span>
          </div>

          <section className="receipt-meta-grid" aria-label={english ? "Order information" : "订单基本信息"}>
            <div>
              <span>{english ? "Signed-in account" : "平台登录账号名"}</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>{english ? "Order created" : "订单创建时间"}</span>
              <strong>{formatBeijingDateTime(order.createdAt, locale)} {english ? "(China Standard Time)" : "（北京时间）"}</strong>
            </div>
            <div>
              <span>{english ? "Merchant order number" : "商户订单号"}</span>
              <strong className="receipt-order-number">{order.outTradeNo}</strong>
            </div>
            <div>
              <span>{english ? "Payment method" : "支付方式"}</span>
              <strong>{english ? "Alipay" : "支付宝"}</strong>
            </div>
            {order.alipayTradeNo && (
              <div>
                <span>{english ? "Alipay transaction number" : "支付宝交易号"}</span>
                <strong className="receipt-order-number">{order.alipayTradeNo}</strong>
              </div>
            )}
            {order.paidAt && (
              <div>
                <span>{english ? "Payment completed" : "支付完成时间"}</span>
                <strong>{formatBeijingDateTime(order.paidAt, locale)} {english ? "(China Standard Time)" : "（北京时间）"}</strong>
              </div>
            )}
          </section>

          <section className="receipt-product" aria-label={english ? "Digital product information" : "虚拟商品信息"}>
            <div className="receipt-product-head">
              <span>{english ? "Item" : "商品内容"}</span>
              <span>{english ? "Unit price" : "单价"}</span>
              <span>{english ? "Quantity" : "数量"}</span>
              <span>{english ? "Subtotal" : "小计"}</span>
            </div>
            <div className="receipt-product-row">
              <div>
                <span className="virtual-product-tag">{english ? "Digital product" : "虚拟商品"}</span>
                <strong>{order.subject}</strong>
                <p>{english ? `AI image creation service for ${order.credits} styled ${order.credits === 1 ? "image" : "images"}. Credits are added to this account after payment.` : `AI 图片创作服务，可生成 ${order.credits} 张风格图片；购买后 ${order.credits} 次创作权益自动发放至当前账号。`}</p>
              </div>
              <b>¥{formatYuan(order.amountFen / order.credits)}</b>
              <b>{order.credits} {english ? "credits" : "次"}</b>
              <b>¥{formatYuan(order.amountFen)}</b>
            </div>
          </section>

          <section className="receipt-total-area">
            <div>
              <span>{english ? "Package" : "套餐说明"}</span>
              <strong>{english ? `${order.credits} AI image creation credits` : (creditPackage?.description ?? `${order.credits} 次 AI 图片创作权益`)}</strong>
            </div>
            <div className="receipt-total">
              <span>{english ? "Order total" : "订单金额"}</span>
              <strong><small>¥</small>{formatYuan(order.amountFen)}</strong>
              <p>{english ? "The Alipay transaction is the final payment reference" : "实付金额以支付宝交易结果为准"}</p>
            </div>
          </section>

          <footer className="receipt-footer">
            <span><CheckCircle2 /> {english ? "This is a digital AI service with no physical delivery" : "本商品为数字化 AI 创作服务，无实体物流"}</span>
            <span><Clock3 /> {english ? "Uploads and generated images remain available for only 24 hours" : "用户上传素材与生成图片仅保留 24 小时，请及时下载"}</span>
          </footer>
        </article>

        <PaymentCheckoutActions orderId={order.id} canPay={canPay} locale={locale} />
      </div>
    </main>
  );
}
