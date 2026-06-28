import Link from "next/link";
import { Brand } from "@/components/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between bg-[var(--color-ink-900)] p-12 lg:flex">
        <Link href="/" aria-label="Roomwise home">
          <Brand className="[&_span:last-child]:text-[var(--color-paper-50)]" />
        </Link>
        <div className="max-w-sm">
          <p className="font-serif text-2xl leading-snug text-[var(--color-paper-50)]">
            “Availability isn&apos;t a flag we maintain — it&apos;s computed from
            the live timetable, your bookings and maintenance, every time you
            ask.”
          </p>
        </div>
        <p className="text-sm text-[color-mix(in_oklch,var(--color-paper-50)_70%,transparent)]">
          All times shown in West Africa Time (Africa/Accra).
        </p>
      </aside>

      {/* Form panel */}
      <main id="main" className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
