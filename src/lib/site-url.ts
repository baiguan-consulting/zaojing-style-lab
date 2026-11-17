const PRODUCTION_SITE_URL = "https://picture.baiguan-consulting.com";

export function getSiteUrl() {
  try {
    return new URL(process.env.APP_BASE_URL?.trim() || PRODUCTION_SITE_URL);
  } catch {
    return new URL(PRODUCTION_SITE_URL);
  }
}

export function absoluteSiteUrl(pathname: string) {
  return new URL(pathname, getSiteUrl()).toString();
}
