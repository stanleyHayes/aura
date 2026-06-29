import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuraLogo } from "@/components/aura-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(155deg,var(--color-maroon),var(--color-maroon-dark))] p-12 text-[var(--color-paper-50)] lg:flex">
        <Link href="/" aria-label="AURA home" className="relative z-10">
          <Brand className="[&_span:last-child]:text-[var(--color-paper-50)]" />
        </Link>
        <div className="relative z-10 max-w-sm">
          <p className="text-3xl font-semibold leading-tight">
            Smart Space Management for Ashesi.
          </p>
          <p className="mt-3 text-base text-[color-mix(in_oklch,var(--color-paper-50)_85%,transparent)]">
            Reserve classrooms and campus facilities, see real-time availability,
            and manage approvals — all in one place.
          </p>
        </div>
        <p className="relative z-10 text-sm text-[color-mix(in_oklch,var(--color-paper-50)_70%,transparent)]">
          All times shown in West Africa Time (Africa/Accra).
        </p>
        {/* Decorative AURA "A" motif. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-16 text-[color-mix(in_oklch,var(--color-paper-50)_10%,transparent)]"
        >
          <AuraLogo className="size-72" />
        </span>
      </aside>

      {/* Form panel */}
      <main id="main" className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
