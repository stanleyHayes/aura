import type { MetadataRoute } from "next";
import type { Room } from "@cbs/schemas";
import { apiOrigin, env } from "@/lib/env";

/**
 * Sitemap (§12.1, §12.3). Only public surfaces are listed; `/app`, `/admin`
 * and `/api` are intentionally excluded (they are noindex).
 *
 * Active rooms are fetched anonymously from the public catalogue endpoint
 * (the same pattern used by the public `/rooms` directory page). The fetch is
 * fail-soft: if the API is unreachable we still emit the static routes so the
 * build never breaks.
 */
export const revalidate = 3600;

async function fetchPublicRooms(): Promise<Room[]> {
  try {
    const res = await fetch(
      `${apiOrigin}/api/v1/public/rooms?status=ACTIVE&limit=500`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Room[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/rooms`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const rooms = await fetchPublicRooms();

  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: `${base}/rooms/${room.id}`,
    lastModified: room.updated_at ? new Date(room.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...roomRoutes];
}
