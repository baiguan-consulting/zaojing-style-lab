import { requireUserPage } from "@/lib/user-page-auth";

export const dynamic = "force-dynamic";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage("/creator");
  return children;
}
