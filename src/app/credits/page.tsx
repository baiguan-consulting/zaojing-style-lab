import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreditShop } from "@/components/credit-shop";
import { SiteHeader } from "@/components/site-header";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const locale = await getLocale();
  const english = locale === "en";
  return (
    <main>
      <SiteHeader />
      <div className="wallet-shell">
        <Link href={localizedPath(locale, "/")} className="back-link"><ArrowLeft /> {english ? "Back to styles" : "返回模板库"}</Link>
        <header className="wallet-page-header">
          <span className="eyebrow">CREATION WALLET</span>
          <h1>{english ? <>Credits for every<br /><span>creative moment.</span></> : <>每一次创作，<br /><span>都清清楚楚。</span></>}</h1>
          <p>{english ? "Choose a credit pack and use it with any published style." : "选择适合的创作次数，购买后可以在任意已上线模板中使用。"}</p>
        </header>
        <CreditShop locale={locale} />
      </div>
    </main>
  );
}
