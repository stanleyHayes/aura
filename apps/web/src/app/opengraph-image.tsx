import { ImageResponse } from "next/og";

/**
 * Default Open Graph image (§12.1) generated at build time via `next/og`.
 * AURA maroon branding with the product tagline. Dependency-free: inline styles
 * and system fonts only, so it never reaches out to the network or a paid
 * service during the build.
 *
 * This file is auto-detected by Next.js for `/opengraph-image` and is also the
 * default OG image for every route that does not provide its own. The companion
 * `twitter-image.tsx` re-exports it so the Twitter card matches.
 */
export const runtime = "nodejs";
export const alt = "AURA — Smart Space Management for Ashesi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MAROON = "#7B1113";
const MAROON_DARK = "#5C0D0F";
const PAPER = "#FBFBF9";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: MAROON,
          backgroundImage: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DARK} 100%)`,
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
          color: PAPER,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "96px",
              height: "96px",
              borderRadius: "20px",
              backgroundColor: PAPER,
              color: MAROON,
              fontSize: "64px",
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "64px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              AURA
            </div>
            <div style={{ fontSize: "26px", opacity: 0.85 }}>
              Ashesi University Resource Allocation
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "900px",
            }}
          >
            Smart Space Management for Ashesi
          </div>
          <div style={{ fontSize: "30px", opacity: 0.85, maxWidth: "880px" }}>
            Reserve classrooms and campus facilities with real-time availability,
            approvals and conflict detection.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
