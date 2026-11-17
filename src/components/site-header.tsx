import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Grid2X2, House, Palette, ShieldCheck, WalletCards } from "lucide-react";

import { AccountButton } from "@/components/account-button";
import { AdminPortalLink } from "@/components/admin-portal-link";
import { LanguageSwitch } from "@/components/language-switch";
import { localizedPath } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";

export async function SiteHeader() {
  const locale = await getLocale();
  const english = locale === "en";
  return (
    <>
      <header className="site-header">
        <Link href={localizedPath(locale, "/")} className="brand" aria-label={english ? "Zaojing home" : "造境首页"}>
          <span className="brand-mark">造</span>
          <span>
            <strong>{english ? "ZAOJING" : "造境"}</strong>
            <small>STYLE LAB</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label={english ? "Primary navigation" : "主导航"}>
          <Link href={localizedPath(locale, "/#templates")} className="templates-nav-link">
            <Grid2X2 size={16} /> {english ? "Styles" : "风格模板"}
          </Link>
          <span className="privacy-pill">
            <ShieldCheck size={15} /> {english ? "Images expire in 24h" : "图片仅保留 24 小时"}
          </span>
          <Link href={localizedPath(locale, "/credits")} className="credits-nav-link">
            <WalletCards size={16} /> {english ? "Credits" : "购买次数"}
          </Link>
          <Link href="/creator" className="creator-nav-link">
            <Palette size={16} /> {english ? "Creator" : "创作者中心"}
          </Link>
          <LanguageSwitch locale={locale} />
          <AccountButton locale={locale} />
          <Suspense fallback={null}>
            <AdminPortalLink className="admin-link">
              {english ? "Admin" : "管理后台"} <ArrowUpRight size={15} />
            </AdminPortalLink>
          </Suspense>
        </nav>
      </header>
      <nav className="mobile-site-nav" aria-label={english ? "Mobile navigation" : "手机导航"}>
        <Link href={localizedPath(locale, "/")}><House /> <span>{english ? "Home" : "首页"}</span></Link>
        <Link href={localizedPath(locale, "/#templates")}><Grid2X2 /> <span>{english ? "Styles" : "模板"}</span></Link>
        <Link href={localizedPath(locale, "/credits")}><WalletCards /> <span>{english ? "Credits" : "次数"}</span></Link>
        <Link href="/creator"><Palette /> <span>{english ? "Creator" : "创作者"}</span></Link>
      </nav>
    </>
  );
}
