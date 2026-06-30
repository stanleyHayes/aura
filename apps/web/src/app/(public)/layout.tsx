import Link from "next/link";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/public-header";
import { env } from "@/lib/env";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = env.siteUrl.replace(/\/$/, "");

  // Site-wide structured data (§12.1) — scoped to the PUBLIC surface only (the
  // app/admin layouts are noindex and deliberately omit this). Declares the
  // organisation behind AURA and a WebSite entity whose SearchAction lets
  // search engines deep-link directly into the facility directory.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Ashesi University",
        alternateName: "AURA — Ashesi University Resource Allocation",
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "AURA — Ashesi University Resource Allocation",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/rooms?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape "<" so the JSON can't break out of the script tag, matching
          // the room JSON-LD pattern elsewhere in the public surface.
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PublicHeader />

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Brand />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Smart space management for Ashesi — classrooms and campus
              facilities in one place.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-4 text-sm">
            <Link className="hover:underline" href="/rooms">
              Room directory
            </Link>
            <Link className="hover:underline" href="/login">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          <p className="mx-auto max-w-6xl text-xs text-[var(--color-muted-foreground)]">
            © {new Date().getFullYear()} Ashesi University · AURA. All times
            shown in West Africa Time (Africa/Accra).
          </p>
        </div>
      </footer>
    </div>
  );
}
