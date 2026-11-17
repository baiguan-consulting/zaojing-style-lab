import type { MetadataRoute } from "next";

import { localizedPath } from "@/lib/locale";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getPublishedTemplates } from "@/lib/template-store";

export const dynamic = "force-dynamic";

function localizedEntries(pathname: string, lastModified?: Date): MetadataRoute.Sitemap {
  const zh = absoluteSiteUrl(localizedPath("zh", pathname));
  const en = absoluteSiteUrl(localizedPath("en", pathname));
  const languages = { "zh-CN": zh, en, "x-default": zh };
  return [
    { url: zh, lastModified, alternates: { languages } },
    { url: en, lastModified, alternates: { languages } },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const templates = await getPublishedTemplates();
  const latestUpdate = templates
    .map((template) => Date.parse(template.updatedAt))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  return [
    ...localizedEntries("/", latestUpdate ? new Date(latestUpdate) : undefined),
    ...templates.flatMap((template) => localizedEntries(
      `/templates/${template.slug}`,
      Number.isFinite(Date.parse(template.updatedAt)) ? new Date(template.updatedAt) : undefined,
    )),
  ];
}
