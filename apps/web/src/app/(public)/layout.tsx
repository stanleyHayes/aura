import Link from "next/link";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/public-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-paper-100)]">
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
