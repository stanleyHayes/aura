import type { MetadataRoute } from "next";
import { createApi } from "@cbs/api-client";
import type { Room } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";

/**
 * Sitemap (§12.1, §12.3). Only public surfaces are listed; `/app`, `/admin`
 * and `/api` are intentionally excluded (they are noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/rooms`, changeFrequency: "daily", priority: 0.8 },
  ];

  let rooms: Room[] = [];
  try {
    const api = createApi({ baseUrl: apiOrigin });
    const { data } = await api.GET("/api/v1/rooms", {
      params: { query: { status: "ACTIVE", limit: 500 } },
    });
    rooms = (data?.data ?? []) as Room[];
  } catch {
    rooms = [];
  }

  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: `${base}/rooms/${room.id}`,
    lastModified: room.updated_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...roomRoutes];
}
