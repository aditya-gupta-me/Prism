import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl().origin;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/projects/",
          "/sign-in",
          "/sign-up",
          "/monitoring",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
