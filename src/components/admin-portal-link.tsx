import type { ReactNode } from "react";
import Link from "next/link";

import { getOptionalAdminUser } from "@/lib/admin-page-auth";

type AdminPortalLinkProps = {
  children: ReactNode;
  className?: string;
};

export async function AdminPortalLink({ children, className }: AdminPortalLinkProps) {
  const admin = await getOptionalAdminUser();
  if (!admin) return null;

  return <Link href="/admin" className={className}>{children}</Link>;
}
