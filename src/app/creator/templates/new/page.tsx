import { redirect } from "next/navigation";

import { CreatorShell } from "@/components/creator-shell";
import { CreatorTemplateForm } from "@/components/creator-template-form";
import { getCreatorProfile } from "@/lib/creator-store";
import { requireUserPage } from "@/lib/user-page-auth";

export default async function CreatorNewTemplatePage() {
  const user = await requireUserPage("/creator/templates/new");
  const profile = await getCreatorProfile(user.id);
  if (!profile) redirect("/creator");
  return <CreatorShell active="new"><header className="creator-page-header"><div><span className="creator-kicker">SUBMIT A STYLE</span><h1>投稿新模板</h1><p>只需要提示词和上下对照图，其余工作交给平台。</p></div></header><CreatorTemplateForm /></CreatorShell>;
}
