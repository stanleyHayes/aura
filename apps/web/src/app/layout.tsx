import type { Metadata, Viewport } from "next";
import { fontSans, fontSerif } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Roomwise — University Classroom Booking",
    template: "%s · Roomwise",
  },
  description:
    "Search classroom availability, request rooms, and manage the university timetable in one place.",
  applicationName: "Roomwise",
  authors: [{ name: "University ICT Directorate" }],
  openGraph: {
    type: "website",
    siteName: "Roomwise",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#191a22" },
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
  return (
    <html lang="en-GB" className={`${fontSans.variable} ${fontSerif.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm text-[var(--color-primary-foreground)]">
          Skip to main content
        </a>
        <Providers session={null}>{children}</Providers>
      </body>
    </html>
  );
}
