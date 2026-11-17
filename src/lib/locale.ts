export const LOCALE_COOKIE = "zaojing_locale";

export type Locale = "zh" | "en";

export function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh";
}

export function isEnglish(locale: Locale) {
  return locale === "en";
}

const UNPREFIXED_PATHS = ["/api", "/admin", "/creator", "/uploads", "/_next"];

function staysUnprefixed(pathname: string) {
  return UNPREFIXED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || ["/favicon.ico", "/robots.txt", "/sitemap.xml"].includes(pathname);
}

export function localizedPath(locale: Locale, path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;

  const suffixIndex = path.search(/[?#]/);
  const rawPathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const pathname = rawPathname === "/en"
    ? "/"
    : rawPathname.startsWith("/en/")
      ? rawPathname.slice(3)
      : rawPathname;

  if (locale === "zh" || staysUnprefixed(pathname)) return `${pathname}${suffix}`;
  if (pathname === "/") return suffix.startsWith("#") ? `/en/${suffix}` : `/en${suffix}`;
  return `/en${pathname}${suffix}`;
}
