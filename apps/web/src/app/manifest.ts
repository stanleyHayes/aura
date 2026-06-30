import type { MetadataRoute } from "next";

/**
 * Web App Manifest (§12.1). Installable PWA metadata for the AURA marketing
 * surface. Icons reference the existing app icon (`src/app/icon.svg`, served at
 * `/icon.svg`), which scales cleanly to any size.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AURA — Ashesi University Resource Allocation",
    short_name: "AURA",
    description:
      "AURA is Ashesi University's resource-allocation and reservation platform — reserve classrooms and campus facilities with real-time availability, approvals, conflict detection and scheduling.",
    start_url: "/",
    display: "standalone",
    theme_color: "#7B1113",
    background_color: "#FBFBF9",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
