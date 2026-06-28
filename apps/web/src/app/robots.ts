import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** robots.txt (§12.3): disallow /admin, /app, /api; allow public surfaces. */
export default function robots(): MetadataRoute.Robots {
  const base = env.siteUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/app", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
