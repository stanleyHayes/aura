/** Public, build-time-inlined config (§19.1 — NEXT_PUBLIC_* only, no secrets). */
export const env = {
  /** Institution timezone for all human-facing rendering (§8.1). */
  appTz: process.env.NEXT_PUBLIC_APP_TZ ?? "Africa/Accra",
  /** Canonical site origin for SEO metadata / sitemap (§12.1). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** Server-only: where the Go API lives (the rewrite target, §10). */
export const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:8080";
