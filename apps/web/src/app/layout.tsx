import type { Metadata, Viewport } from "next";
import { fontSans } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "AURA — Ashesi University Resource Allocation",
    template: "%s · AURA",
  },
  description:
    "AURA is Ashesi University's resource-allocation and reservation platform — reserve classrooms and campus facilities with real-time availability, approvals, conflict detection and scheduling.",
  applicationName: "AURA",
  authors: [{ name: "Ashesi University" }],
  openGraph: {
    type: "website",
    siteName: "AURA — Ashesi University Resource Allocation",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFBF9" },
    { media: "(prefers-color-scheme: dark)", color: "#23201F" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: the root layout intentionally does NOT read cookies/session, so the
  // (public) marketing + room-directory pages remain statically renderable for
  // SEO (§12.1). The client `SessionHydrator` fetches /auth/me for interactive
  // chrome, and the (app)/(admin) server layouts perform the authoritative
  // server-side session gate themselves (§9.2).
  // suppressHydrationWarning: browser extensions (Grammarly's data-gr-*, screen
  // recorders' data-scribe-recorder-ready, an injected `brand-refresh` class)
  // mutate <html>/<body> before React hydrates. Those injected attributes are
  // not a code defect; this flag stops them from tripping a hydration mismatch
  // (it only relaxes attribute diffing on these two elements).
  return (
    <html
      lang="en-GB"
      className={fontSans.variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <a href="#main" className="skip-link rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm text-[var(--color-primary-foreground)]">
          Skip to main content
        </a>
        <Providers session={null}>{children}</Providers>
      </body>
    </html>
  );
}
