import Link from "next/link";
import { ArrowLeft, Boxes, CreditCard, Inbox, KeyRound, LayoutDashboard, Plus, Settings2, UsersRound } from "lucide-react";

export function AdminShell({ children, active = "templates" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand"><span>造</span><div><strong>造境后台</strong><small>STYLE LAB ADMIN</small></div></Link>
        <nav>
          <Link href="/admin" className={active === "dashboard" ? "active" : ""}><LayoutDashboard /> 总览</Link>
          <Link href="/admin" className={active === "templates" ? "active" : ""}><Boxes /> 模板管理</Link>
          <Link href="/admin/import" className={active === "import" ? "active" : ""}><Inbox /> 一键发布</Link>
          <Link href="/admin/templates/new" className={active === "new" ? "active" : ""}><Plus /> 新建模板</Link>
          <Link href="/admin/creators" className={active === "creators" ? "active" : ""}><UsersRound /> 创作者审核</Link>
          <Link href="/admin/providers" className={active === "providers" ? "active" : ""}><KeyRound /> 模型服务</Link>
          <Link href="/admin/payments" className={active === "payments" ? "active" : ""}><CreditCard /> 支付配置</Link>
          <span className="admin-nav-disabled"><Settings2 /> 系统设置 <small>下一步</small></span>
        </nav>
        <div className="admin-side-note"><strong>本地雏形</strong><p>模板和图片保存在本机项目中，接入部署环境时将迁移到数据库和对象存储。</p></div>
        <Link href="/" className="back-to-site"><ArrowLeft /> 返回用户前台</Link>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
