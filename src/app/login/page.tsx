import Link from "next/link";
import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react";

import { EmailLoginForm } from "@/components/email-login-form";
import { LanguageSwitch } from "@/components/language-switch";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const english = locale === "en";
  const requestedNext = typeof params.next === "string" ? params.next : localizedPath(locale, "/");
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : localizedPath(locale, "/");

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-top-row">
          <Link href={localizedPath(locale, "/")} className="login-brand">
            <span className="brand-mark">造</span>
            <strong>{english ? "ZAOJING STYLE LAB" : "造境 STYLE LAB"}</strong>
          </Link>
          <LanguageSwitch locale={locale} />
        </div>
        <div>
          <span className="eyebrow">ONE CODE · ONE ACCOUNT</span>
          <h2>{english ? <>Keep every spark<br />close at hand.</> : <>把每一次灵感，<br />留在你的账户里。</>}</h2>
          <p>{english ? "Sign in to buy credits, create images, and review orders. Browsing styles never requires an account." : "登录后即可购买创作次数、生成图片并查看订单。模板浏览始终无需登录。"}</p>
        </div>
        <div className="login-trust-list">
          <span><ShieldCheck /> {english ? "Codes expire in 5 minutes and work only once" : "验证码 5 分钟有效，使用后立即失效"}</span>
          <span><Clock3 /> {english ? "Uploads and generated images stay for only 24 hours" : "上传原图与生成图片仅保留 24 小时"}</span>
        </div>
      </section>
      <section className="login-form-shell">
        <Link href={nextPath} className="back-link"><ArrowLeft /> {english ? "Back" : "返回"}</Link>
        <EmailLoginForm nextPath={nextPath} locale={locale} />
      </section>
    </main>
  );
}
