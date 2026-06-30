import Link from "next/link";
import { CalendarClock, ShieldCheck, GraduationCap } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuraWatermark } from "@/components/watermark";

const TRUST_POINTS = [
  {
    icon: CalendarClock,
    title: "Real-time availability",
    detail: "See open rooms the moment they free up.",
  },
  {
    icon: ShieldCheck,
    title: "Approval-aware booking",
    detail: "Requests route to the right officer automatically.",
  },
  {
    icon: GraduationCap,
    title: "Academic timetable aligned",
    detail: "Never clashes with scheduled lectures.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-[var(--color-background)] md:grid-cols-[0.9fr_1.1fr]">
      <div className="relative overflow-hidden rounded-b-[2rem] bg-[var(--color-maroon)] px-4 pb-6 pt-4 text-[var(--color-paper-50)] shadow-[0_18px_45px_color-mix(in_oklch,var(--color-maroon-dark)_24%,transparent)] sm:px-6 sm:pb-7 md:hidden">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <Link
            href="/"
            aria-label="AURA home"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-paper-50)]"
          >
            <Brand className="gap-3 [&_span:first-child]:size-11 [&_span:first-child]:rounded-2xl [&_span:first-child]:bg-[var(--color-paper-50)] [&_span:first-child]:text-[var(--color-maroon)] [&_span:first-child_svg]:size-7 [&_span:last-child]:text-xl [&_span:last-child]:text-[var(--color-paper-50)]" />
          </Link>
          <div className="max-w-[11.5rem] text-right">
            <p className="text-sm font-semibold leading-5 text-[var(--color-paper-50)]">
              Smart Space Management
            </p>
            <p className="text-xs font-medium leading-5 text-[color-mix(in_oklch,var(--color-paper-50)_78%,transparent)]">
              for Ashesi.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-7 max-w-sm">
          <p className="text-balance text-2xl font-semibold leading-tight">
            Reserve campus spaces without the back-and-forth.
          </p>
          <p className="mt-2 text-sm leading-6 text-[color-mix(in_oklch,var(--color-paper-50)_76%,transparent)]">
            Live availability, approvals, and timetable checks in one secure place.
          </p>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2 text-center">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-xl border border-[color-mix(in_oklch,var(--color-paper-50)_14%,transparent)] bg-[color-mix(in_oklch,var(--color-paper-50)_8%,transparent)] px-2 py-2.5 backdrop-blur-sm"
            >
              <point.icon
                className="mx-auto size-4 text-[color-mix(in_oklch,var(--color-paper-50)_88%,transparent)]"
                aria-hidden="true"
              />
              <span className="mt-1 block text-[0.68rem] font-semibold leading-tight text-[color-mix(in_oklch,var(--color-paper-50)_80%,transparent)]">
                {point.title}
              </span>
            </div>
          ))}
        </div>

        <AuraWatermark
          tone="brand"
          className="-right-12 -top-14 size-44 rotate-[-10deg] opacity-70"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-[color-mix(in_oklch,var(--color-paper-50)_24%,transparent)]"
        />
      </div>

      <aside
        className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[var(--color-maroon)] p-12 text-[var(--color-paper-50)] md:flex"
      >
        <Link href="/" aria-label="AURA home" className="relative z-10">
          <Brand className="[&_span:first-child]:bg-[var(--color-paper-50)] [&_span:first-child]:text-[var(--color-maroon)] [&_span:last-child]:text-[var(--color-paper-50)]" />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="text-4xl font-semibold leading-tight">
            Smart Space Management for Ashesi.
          </p>
          <p className="mt-4 text-base leading-7 text-[color-mix(in_oklch,var(--color-paper-50)_84%,transparent)]">
            Reserve classrooms and campus facilities, see real-time availability,
            and manage approvals — all in one place.
          </p>
          <div className="mt-8 grid gap-3">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.title}
                className="flex items-start gap-3.5 rounded-xl border border-[color-mix(in_oklch,var(--color-paper-50)_16%,transparent)] bg-[color-mix(in_oklch,var(--color-paper-50)_8%,transparent)] px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-[color-mix(in_oklch,var(--color-paper-50)_12%,transparent)]"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--color-paper-50)_15%,transparent)] text-[var(--color-paper-50)] ring-1 ring-[color-mix(in_oklch,var(--color-paper-50)_20%,transparent)]">
                  <point.icon className="size-[1.15rem]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-tight">
                    {point.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-[color-mix(in_oklch,var(--color-paper-50)_72%,transparent)]">
                    {point.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-sm text-[color-mix(in_oklch,var(--color-paper-50)_70%,transparent)]">
          All times shown in West Africa Time (Africa/Accra).
        </p>
        <AuraWatermark
          tone="brand"
          className="-right-20 -bottom-20 size-80 rotate-[-8deg]"
        />
        <AuraWatermark
          tone="brand"
          className="left-8 top-28 size-40 rotate-[11deg] opacity-55"
        />
        <span className="pointer-events-none absolute left-12 top-32 h-px w-44 bg-[var(--color-paper-50)] opacity-20" />
        <span className="pointer-events-none absolute left-24 top-40 h-px w-72 bg-[var(--color-paper-50)] opacity-10" />
      </aside>

      <main id="main" className="relative flex items-center justify-center p-4 md:p-8">
        <div className="absolute right-4 top-4 md:right-8 md:top-8">
          <ThemeToggle />
        </div>
        <section
          aria-label="Authentication"
          className="w-full max-w-[27rem] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_24px_80px_color-mix(in_oklch,var(--color-ink-950)_14%,transparent)] md:p-7"
        >
          {children}
        </section>
      </main>
    </div>
  );
}
