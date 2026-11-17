import { AdminShell } from "@/components/admin-shell";
import { TemplateForm } from "@/components/template-form";

export default function NewTemplatePage() {
  return <AdminShell active="new"><TemplateForm /></AdminShell>;
}
