import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AUTH_SESSION_COOKIE, authenticateSessionToken } from "./auth";
import { requireAdminEmail } from "./admin-auth";

export const getOptionalAdminUser = cache(async () => {
  try {
    const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
    const user = await authenticateSessionToken(token);
    if (!user) return null;
    requireAdminEmail(user.email);
    return user;
  } catch {
    // Public navigation must fail closed when auth or the database is unavailable.
    return null;
  }
});

export async function requireAdminPage() {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  const user = await authenticateSessionToken(token);
  if (!user) redirect("/login?next=/admin");
  try {
    requireAdminEmail(user.email);
  } catch {
    notFound();
  }
  return user;
}
