import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/templates/", "/en/templates/"],
      disallow: [
        "/admin/",
        "/api/",
        "/creator/",
        "/credits/",
        "/en/credits/",
        "/login",
        "/en/login",
        "/payment/",
        "/en/payment/",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
