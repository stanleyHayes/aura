import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * robots.txt (§12.3): allow the public marketing surface (`/`, `/rooms`,
 * `/rooms/[id]`, `/login`); disallow the authenticated app/admin areas and the
 * API proxy so they are never indexed. Points crawlers at the sitemap and
 * declares the canonical host.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.siteUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
