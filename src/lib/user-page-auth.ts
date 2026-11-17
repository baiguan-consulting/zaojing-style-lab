import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_SESSION_COOKIE, authenticateSessionToken } from "./auth";

export async function requireUserPage(nextPath: string) {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  const user = await authenticateSessionToken(token);
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
