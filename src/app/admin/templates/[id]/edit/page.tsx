import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { TemplateForm } from "@/components/template-form";
import { getTemplateById } from "@/lib/template-store";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getTemplateById(id);
  if (!template) notFound();

  return <AdminShell active="templates"><TemplateForm template={template} /></AdminShell>;
}
