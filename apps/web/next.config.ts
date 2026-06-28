import type { NextConfig } from "next";

/**
 * Next.js 16 configuration (§10, §12).
 *
 * - Rewrites `/api/v1/*` to the Go API (default http://localhost:8080) so the
 *   browser talks same-origin and httpOnly `__Host-*` cookies flow (§9.2).
 * - Security headers (§14); a strict CSP is layered in middleware with a nonce.
 * - `transpilePackages` for the workspace packages.
 * - Authenticated + admin surfaces send `X-Robots-Tag: noindex` here and via
 *   middleware (§12.3).
 */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@cbs/ui", "@cbs/schemas", "@cbs/api-client"],
  // `typedRoutes` is stable in Next.js 16.
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      // §12.3 — never index app/admin/api.
      {
        source: "/app/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
