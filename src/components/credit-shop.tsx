"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Coins, LoaderCircle, LogIn, QrCode, ShieldCheck, Smartphone, WalletCards, X } from "lucide-react";

import { formatBeijingDateTime, orderStatusLabel } from "@/lib/payment-display";
import { CREDIT_PACKAGES, formatYuan } from "@/lib/payment-packages";
import { localizedPath, type Locale } from "@/lib/locale";

type Account = {
  paymentMode: "NOWPAY_DIRECT" | "LEGACY";
  balanceCredits: number;
  rewardCredits?: number;
  user: { email: string; emailMasked: string };
  product?: {
    capabilityStatus: string;
    options: Array<{
      skuId: string;
      label: string;
      quota: number | null;
      amountFen: number | null;
    }>;
  };
  purchases?: Array<{
    id: string;
    status: string;
    createdAt: string;
    option?: { label?: string; quota?: number; amountFen?: number };
  }>;
  orders: Array<{
    id: string;
    outTradeNo: string;
    amountFen: number;
    credits: number;
    status: string;
    createdAt: string;
  }>;
};

type NowPayPurchaseEntry = {
  purchaseId: string;
  purchaseUrl: string;
  purchaseQrCode?: string;
  expireTime?: string;
};

type PendingPurchase = {
  purchaseId: string;
  remainingBefore: number;
  startedAt: number;
};

const PENDING_PURCHASE_KEY = "zaojing:pending-nowpay-purchase";

export function CreditShop({ locale }: { locale: Locale }) {
  const router = useRouter();
  const english = locale === "en";
  const [account, setAccount] = useState<Account | null>(null);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [purchaseEntry, setPurchaseEntry] = useState<NowPayPurchaseEntry | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState("");
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const [launchMessage, setLaunchMessage] = useState("");

  const loadAccount = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 || data.loginRequired) setLoginRequired(true);
      throw new Error(data.error ?? (english ? "Could not load your account" : "账户加载失败"));
    }
    setAccount(data);
    return data as Account;
  }, [english]);

  useEffect(() => {
    Promise.resolve()
      .then(() => loadAccount())
      .catch((caught) => setError(caught instanceof Error ? caught.message : (english ? "Could not load your account" : "账户加载失败")));
  }, [english, loadAccount]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsEmbeddedBrowser(/MicroMessenger|QQ\/|Weibo|DingTalk/i.test(navigator.userAgent));
      const saved = sessionStorage.getItem(PENDING_PURCHASE_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as PendingPurchase;
        if (
          typeof parsed.purchaseId === "string"
          && Number.isFinite(parsed.remainingBefore)
          && Number.isFinite(parsed.startedAt)
          && Date.now() - parsed.startedAt < 30 * 60 * 1000
        ) {
          setPendingPurchase(parsed);
        } else {
          sessionStorage.removeItem(PENDING_PURCHASE_KEY);
        }
      } catch {
        sessionStorage.removeItem(PENDING_PURCHASE_KEY);
      }
    });
  }, []);

  useEffect(() => {
    if (!pendingPurchase) return;
    const currentPurchase = pendingPurchase;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pollPurchase() {
      if (cancelled) return;
      try {
        const response = await fetch(`/api/payments/nowpay/purchase/${currentPurchase.purchaseId}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (response.status === 401 || data.loginRequired) setLoginRequired(true);
        if (response.ok && data.confirmed) {
          sessionStorage.removeItem(PENDING_PURCHASE_KEY);
          setPendingPurchase(null);
          setPurchaseEntry(null);
          const refreshed = await loadAccount();
          setPurchaseNotice(english ? `Payment complete. You now have ${refreshed.balanceCredits} credits.` : `支付完成，当前剩余 ${refreshed.balanceCredits} 次创作次数。`);
          return;
        }
      } catch {
        // Transient query failures keep the original purchase pending.
      }
      if (!cancelled && Date.now() - currentPurchase.startedAt < 30 * 60 * 1000) {
        timer = setTimeout(pollPurchase, 2500);
      }
    }

    timer = setTimeout(pollPurchase, 1200);
    const checkWhenVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) clearTimeout(timer);
      void pollPurchase();
    };
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [english, loadAccount, pendingPurchase]);

  async function purchase(packageId: string) {
    setError("");
    setLoadingPackage(packageId);
    try {
      const response = await fetch("/api/payments/alipay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || data.loginRequired) setLoginRequired(true);
        throw new Error(data.error ?? (english ? "Could not create the payment order" : "支付订单创建失败"));
      }
      router.push(localizedPath(locale, `/credits/orders/${data.order.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (english ? "Could not start payment" : "支付发起失败"));
      setLoadingPackage(null);
    }
  }

  async function purchaseNowPay(skuId: string) {
    setError("");
    setPurchaseNotice("");
    setLaunchMessage("");
    setLoadingPackage(skuId);
    try {
      const response = await fetch("/api/payments/nowpay/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || data.loginRequired) setLoginRequired(true);
        throw new Error(data.error ?? (english ? "Could not open the Alipay purchase page" : "即刻收购买入口创建失败"));
      }
      const purchaseUrl = new URL(data.purchaseUrl);
      if (purchaseUrl.protocol === "https:") {
        window.location.assign(data.purchaseUrl);
        return;
      }
      if (purchaseUrl.protocol !== "alipays:") throw new Error(english ? "Alipay returned an unsupported purchase link" : "支付宝返回了不受支持的购买入口");
      const pending = {
        purchaseId: data.purchaseId,
        remainingBefore: account?.balanceCredits ?? 0,
        startedAt: Date.parse(data.createdAt),
      };
      sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(pending));
      setPendingPurchase(pending);
      setPurchaseEntry({
        purchaseId: data.purchaseId,
        purchaseUrl: data.purchaseUrl,
        purchaseQrCode: data.purchaseQrCode,
        expireTime: data.expireTime,
      });
      setLoadingPackage(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (english ? "Could not create the purchase link" : "购买入口创建失败"));
      setLoadingPackage(null);
    }
  }

  function openAlipayApp() {
    if (!purchaseEntry) return;
    if (isEmbeddedBrowser) {
      setLaunchMessage(english ? "This in-app browser may block Alipay. Use the top-right menu to open this page in your system browser." : "当前内置浏览器可能阻止打开支付宝。请点击右上角菜单，选择“在浏览器中打开”后重试。");
      return;
    }
    setLaunchMessage(english ? "Opening Alipay… If nothing happens, confirm that Alipay is installed or reopen this page in your system browser." : "正在尝试打开支付宝…如果没有反应，请确认已安装支付宝，或改用系统浏览器打开本页。");
    window.location.assign(purchaseEntry.purchaseUrl);
  }

  return (
    <div className="wallet-layout">
      <section className="wallet-balance-card">
        <span className="eyebrow"><WalletCards size={15} /> MY CREATION BALANCE</span>
        <div className="wallet-balance-value">
          <strong>{account ? account.balanceCredits + (account.rewardCredits ?? 0) : "—"}</strong>
          <span>{english ? "Available creation credits" : "可用创作次数合计"}</span>
        </div>
        {account && (
          <div className="wallet-balance-breakdown">
            <span>{english ? "Purchased" : "支付宝购买次数"} <strong>{account.balanceCredits}</strong></span>
            <span>{english ? "Rewards" : "平台奖励次数"} <strong>{account.rewardCredits ?? 0}</strong></span>
          </div>
        )}
        <p>{english ? "Use credits with any published style. Each successfully delivered image uses one credit." : "剩余次数可用于任意已上线模板，每成功生成 1 张作品消耗 1 次。"}</p>
        {account?.user && <span className="wallet-owner">{english ? "Current account" : "当前账户"} · {account.user.email}</span>}
        <div className="wallet-trust-row">
          <span><CheckCircle2 /> {english ? "Credits arrive automatically" : "支付成功自动到账"}</span>
          <span><ShieldCheck /> {english ? "Purchases and usage stay traceable" : "购买和使用记录清晰可查"}</span>
        </div>
      </section>

      <section className="package-section">
        <div className="package-heading">
          <div>
            <span className="eyebrow">{account?.paymentMode === "NOWPAY_DIRECT" ? "VIBE PAY · NOWPAY" : "ALIPAY CHECKOUT"}</span>
            <h2>{english ? "Buy creation credits" : "购买创作次数"}</h2>
          </div>
          <p>{account?.paymentMode === "NOWPAY_DIRECT" ? (english ? "Packages and prices are managed by Alipay. The hosted checkout is the final reference." : "商品档位和价格由支付宝“即刻收”管理，以托管购买页为准。") : (english ? "A flat ¥0.5 per image, with no package markup." : "当前统一为 ¥0.5 / 张，不设置套餐价差。")}</p>
        </div>
        {account?.paymentMode === "NOWPAY_DIRECT" ? (
          account.product?.capabilityStatus === "ENABLED" && account.product.options.length ? (
            <div className="package-grid">
              {account.product.options.map((item, index) => (
                <article className={index === 1 ? "package-card featured" : "package-card"} key={item.skuId}>
                  {index === 1 && <span className="package-badge">{english ? "Popular" : "常用"}</span>}
                  <Coins size={22} />
                  <small>{english && item.quota ? `${item.quota}-credit pack` : item.label}</small>
                  <strong>{item.quota ?? "—"}<i> {english ? "credits" : "次"}</i></strong>
                  <p>{english ? "Credits are added to the signed-in account" : "购买后额度累计到当前登录账户"}</p>
                  <div><span>{english ? "Total" : "应付"}</span><b>{item.amountFen === null ? (english ? "See Alipay" : "支付宝页面为准") : `¥${formatYuan(item.amountFen)}`}</b></div>
                  <button type="button" onClick={() => purchaseNowPay(item.skuId)} disabled={Boolean(loadingPackage) || loginRequired}>
                    {loadingPackage === item.skuId ? <><LoaderCircle className="spin" /> {english ? "Opening Alipay" : "正在打开即刻收"}</> : (english ? "Buy with Alipay" : "支付宝购买")}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="payment-error">{english ? `The Alipay product is currently unavailable (${account?.product?.capabilityStatus ?? "loading"}).` : `即刻收商品当前不可购买（${account?.product?.capabilityStatus ?? "正在读取"}）。请在支付宝“即刻收”管理小程序检查商品状态。`}</p>
          )
        ) : (
          <div className="package-grid">
            {CREDIT_PACKAGES.map((item, index) => (
              <article className={index === 1 ? "package-card featured" : "package-card"} key={item.id}>
                {index === 1 && <span className="package-badge">{english ? "Popular" : "常用"}</span>}
                <Coins size={22} />
                <small>{english ? `${item.credits}-credit pack` : item.name}</small>
                <strong>{item.credits}<i> {english ? "credits" : "次"}</i></strong>
                <p>{english ? `Create ${item.credits} AI ${item.credits === 1 ? "image" : "images"}` : item.description}</p>
                <div><span>{english ? "Total" : "应付"}</span><b>¥{formatYuan(item.amountFen)}</b></div>
                <button type="button" onClick={() => purchase(item.id)} disabled={Boolean(loadingPackage) || loginRequired}>
                  {loadingPackage === item.id ? <><LoaderCircle className="spin" /> {english ? "Creating order" : "正在创建订单"}</> : (english ? "Review and pay" : "查看订单并支付")}
                </button>
              </article>
            ))}
          </div>
        )}
        {error && <p className="payment-error">{error}</p>}
        {purchaseNotice && <p className="payment-success"><CheckCircle2 /> {purchaseNotice}</p>}
        {loginRequired && <Link className="wallet-login-link" href={`${localizedPath(locale, "/login")}?next=${encodeURIComponent(localizedPath(locale, "/credits"))}`}><LogIn /> {english ? "Sign in with email to buy" : "邮箱登录后购买"}</Link>}
      </section>

      {account?.paymentMode === "NOWPAY_DIRECT" ? (
        <section className="order-section">
          <h2>{english ? "Recent purchases" : "最近购买记录"}</h2>
          {account.purchases?.length ? (
            <div className="order-list">
              {account.purchases.map((purchase) => (
                <article className="nowpay-purchase-row" key={purchase.id}>
                  <span>{formatBeijingDateTime(purchase.createdAt, locale)}</span>
                  <strong>{purchase.option?.label ?? (english ? "Creation credit pack" : "即刻收创作次数包")}</strong>
                  <b>{purchase.option?.quota ? `${purchase.option.quota} ${english ? "credits" : "次"}` : "—"}</b>
                  <i data-status={purchase.status}>{purchase.status === "QUOTA_CONFIRMED" ? (english ? "Paid" : "已支付") : (english ? "Pending" : "待支付")}</i>
                </article>
              ))}
            </div>
          ) : <p className="order-empty">{english ? "No purchases yet." : "还没有购买操作。"}</p>}
        </section>
      ) : <section className="order-section">
        <h2>{english ? "Recent orders" : "最近订单"}</h2>
        {!account && !error && <p className="order-empty"><LoaderCircle className="spin" /> {english ? "Loading account" : "正在读取账户"}</p>}
        {account?.orders.length === 0 && <p className="order-empty">{english ? "No orders yet. New purchases will appear here." : "还没有订单，购买后会显示在这里。"}</p>}
        {account && account.orders.length > 0 && (
          <div className="order-list">
            {account.orders.map((order) => (
              <Link href={localizedPath(locale, `/credits/orders/${order.id}`)} key={order.id}>
                <span>{formatBeijingDateTime(order.createdAt, locale)}</span>
                <strong>{order.credits} {english ? "AI image credits" : "次 AI 图片创作"}</strong>
                <b>¥{formatYuan(order.amountFen)}</b>
                <i data-status={order.status}>{orderStatusLabel(order.status, locale)}</i>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </section>}

      <section className="refund-support-section">
        <div>
          <span className="eyebrow">REFUND & SUPPORT</span>
          <h2>{english ? "Refunds & support" : "退款与售后"}</h2>
          <p>{english ? "To request a refund, contact support with your account, purchase time, and credit-pack details. We will review the order and credit usage before processing." : "如需申请退款，请联系人工客服并提供登录账号、购买时间和次数包信息。客服核实订单及次数使用情况后处理。"}</p>
        </div>
        <div className="refund-contact-placeholder">
          <span>{english ? "WeCom" : "企业微信"}<strong>{english ? "Coming soon" : "待补充"}</strong></span>
          <span>{english ? "Support email" : "客服邮箱"}<strong>{english ? "Coming soon" : "待补充"}</strong></span>
        </div>
      </section>

      {purchaseEntry && (
        <div className="nowpay-dialog-backdrop" role="presentation" onMouseDown={() => setPurchaseEntry(null)}>
          <section
            aria-labelledby="nowpay-dialog-title"
            aria-modal="true"
            className="nowpay-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="nowpay-dialog-close" type="button" onClick={() => setPurchaseEntry(null)} aria-label={english ? "Close purchase dialog" : "关闭购买窗口"}>
              <X />
            </button>
            <span className="eyebrow"><QrCode /> ALIPAY HOSTED CHECKOUT</span>
            <h2 id="nowpay-dialog-title">{english ? "Buy credits with Alipay" : "使用支付宝购买创作次数"}</h2>
            {purchaseEntry.purchaseQrCode ? (
              // The QR image is returned by the signed Alipay response and expires shortly.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="nowpay-qr-code" src={purchaseEntry.purchaseQrCode} alt={english ? "Alipay purchase QR code" : "支付宝即刻收购买二维码"} />
            ) : (
              <div className="nowpay-qr-placeholder"><Smartphone /><span>{english ? "Continue on a device with Alipay installed" : "请在安装了支付宝的设备上继续"}</span></div>
            )}
            <p>{english ? "On desktop, scan with Alipay. On mobile, tap Open Alipay. The hosted Alipay page is the final reference for price and credits." : "电脑端请使用支付宝扫码，到账后本页会自动更新；手机端请点击“打开支付宝”。付款金额和次数以支付宝托管页面显示为准。"}</p>
            {isEmbeddedBrowser && <p className="nowpay-browser-warning">{english ? "You are in an in-app browser. Use the top-right menu to reopen this page in your system browser." : "当前是内置浏览器，请先通过右上角菜单在系统浏览器中打开本页。"}</p>}
            {launchMessage && <p className="nowpay-launch-message">{launchMessage}</p>}
            <div className="nowpay-dialog-actions">
              <button className="primary-button nowpay-open-app" type="button" onClick={openAlipayApp}><Smartphone /> {english ? "Open Alipay" : "打开支付宝"}</button>
              <button type="button" className="secondary-button" onClick={() => window.location.reload()}>{english ? "Check balance now" : "立即检查到账"}</button>
            </div>
            <small className="nowpay-auto-check"><LoaderCircle className="spin" /> {english ? "Confirming automatically. Do not pay again if the balance has not updated yet." : "正在自动确认到账；如果余额暂未更新，请不要重复付款。"}</small>
          </section>
        </div>
      )}
    </div>
  );
}
