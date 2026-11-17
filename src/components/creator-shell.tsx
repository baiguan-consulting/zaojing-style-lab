import Link from "next/link";
import { ArrowLeft, Banknote, FilePlus2, LayoutDashboard, ScrollText } from "lucide-react";

export function CreatorShell({ children, active = "home" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="creator-shell">
      <aside className="creator-sidebar">
        <Link href="/" className="creator-brand"><span>造</span><div><strong>创作者中心</strong><small>ZAOJING CREATOR</small></div></Link>
        <nav>
          <Link href="/creator" className={active === "home" ? "active" : ""}><LayoutDashboard /> 创作总览</Link>
          <Link href="/creator/templates/new" className={active === "new" ? "active" : ""}><FilePlus2 /> 投稿新模板</Link>
          <Link href="/creator/earnings" className={active === "earnings" ? "active" : ""}><Banknote /> 收益与提现</Link>
          <Link href="/creator/terms" className={active === "terms" ? "active" : ""}><ScrollText /> 创作者规则</Link>
        </nav>
        <div className="creator-side-note"><strong>用户素材不可见</strong><p>创作者只能查看模板使用次数和收益，不能查看用户上传图片或生成结果。</p></div>
        <Link href="/" className="creator-back"><ArrowLeft /> 返回模板库</Link>
      </aside>
      <main className="creator-main">{children}</main>
    </div>
  );
}
