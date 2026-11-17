import "server-only";

import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, normalizeLocale } from "./locale";

export async function getLocale() {
  const routedLocale = (await headers()).get("x-zaojing-locale");
  if (routedLocale === "en") return "en";
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
