import { AdminShell } from "@/components/admin-shell";
import { QuickImportForm } from "@/components/quick-import-form";

export default function ImportPage() {
  return <AdminShell active="import"><QuickImportForm /></AdminShell>;
}
