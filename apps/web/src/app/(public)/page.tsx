import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarCheck,
  DoorOpen,
  Search,
  ShieldCheck,
  TimerReset,
  Upload,
} from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent } from "@cbs/ui/components/card";
import {
  AuraWatermark,
  IconWatermark,
  WatermarkConstellation,
} from "@/components/watermark";
import { Reveal3D } from "@/components/reveal-3d";

export const metadata: Metadata = {
  title: "Smart Space Management for Ashesi",
  description:
    "AURA is Ashesi University's resource-allocation platform — reserve classrooms and campus facilities with real-time availability from the live timetable, transparent request handling and conflict detection.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "AURA — Smart Space Management for Ashesi",
    description:
      "Reserve Ashesi classrooms and campus facilities with real-time availability, request handling and conflict detection.",
    url: "/",
  },
};

const features = [
  {
    icon: Search,
    title: "Search by what matters",
    body: "Filter by building, capacity, room type and required equipment, then see the exact free intervals for your chosen window.",
  },
  {
    icon: CalendarCheck,
    title: "Availability from the timetable",
    body: "Occupancy is derived from the active-semester lectures, approved bookings and maintenance — never a stale flag.",
  },
  {
    icon: TimerReset,
    title: "Lectures always take precedence",
    body: "Requests that clash with a scheduled lecture are blocked up-front, so you never queue something that can't be approved.",
  },
  {
    icon: ShieldCheck,
    title: "Requests with reasons",
    body: "Booking officers see precisely why a request can or cannot be accepted — competing requests, maintenance, or capacity.",
  },
  {
    icon: Upload,
    title: "Timetable ingestion",
    body: "Upload the semester schedule from Excel or CSV with live progress and a per-row error report.",
  },
  {
    icon: DoorOpen,
    title: "One source of truth",
    body: "Double-booking is prevented in the database itself, not just the interface — the guarantee, not a courtesy.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <AuraWatermark
          className="right-[max(1rem,calc((100vw-72rem)/2))] top-10 hidden size-72 rotate-[-8deg] lg:block"
        />
        <IconWatermark
          icon={CalendarCheck}
          className="left-[max(1rem,calc((100vw-72rem)/2))] bottom-6 hidden size-28 rotate-[-12deg] md:block"
        />
        <IconWatermark
          icon={DoorOpen}
          className="right-[12%] bottom-10 hidden size-20 rotate-12 xl:block"
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
              For Ashesi students, faculty &amp; staff
            </p>
            <h1 className="max-w-[11ch] text-4xl font-bold leading-[1.05] tracking-tight sm:max-w-none sm:text-5xl">
              Smart Space Management for Ashesi.
            </h1>
            <p className="mt-5 max-w-full text-pretty text-lg text-[var(--color-muted-foreground)]">
              AURA lets you reserve Ashesi classrooms and campus facilities with
              real-time availability drawn from the live semester timetable,
              existing bookings and maintenance — with transparent request handling and
              conflict detection built in.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="min-h-12 w-full max-w-[calc(100vw-2rem)] px-12 py-3 text-center leading-tight whitespace-normal sm:w-auto"
                asChild
              >
                <Link href="/login">Sign in to reserve</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 w-full max-w-[calc(100vw-2rem)] border-[var(--color-maroon)] bg-[var(--color-card)] px-12 py-3 text-center leading-tight whitespace-normal text-[var(--color-foreground)] hover:bg-[var(--color-maroon-tint)] hover:text-[var(--color-maroon-dark)] sm:w-auto"
                asChild
              >
                <Link href="/rooms">Browse the facility directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative overflow-hidden">
        <WatermarkConstellation
          icons={[Search, CalendarCheck, TimerReset, ShieldCheck, Upload]}
          className="mx-auto hidden max-w-6xl sm:block"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built around how Ashesi spaces are really used
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
            Lecture occupancy and booking occupancy are kept separate, so
            replacing a semester timetable never disturbs existing reservations.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => (
              <Reveal3D key={title} delay={(i % 3) * 90} className="h-full">
                <Card className="relative h-full overflow-hidden">
                  <IconWatermark
                    icon={Icon}
                    className="-right-8 top-5 size-28 rotate-6"
                  />
                  <CardContent className="relative flex flex-col gap-3 p-6">
                    <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-ink-100)] text-[var(--color-ink-700)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {title}
                    </h3>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {body}
                    </p>
                  </CardContent>
                </Card>
              </Reveal3D>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[color-mix(in_oklch,var(--color-paper-50)_16%,transparent)] bg-[var(--color-maroon)]">
        <AuraWatermark
          tone="brand"
          className="right-[max(1rem,calc((100vw-72rem)/2))] top-[-2rem] size-52 rotate-[-8deg]"
        />
        <IconWatermark
          icon={ShieldCheck}
          tone="brand"
          className="bottom-[-1.5rem] left-[max(1rem,calc((100vw-72rem)/2))] size-36 rotate-12"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-paper-50)]">
              Ready to reserve a space?
            </h2>
            <p className="mt-2 text-[color-mix(in_oklch,var(--color-paper-50)_80%,transparent)]">
              Sign in with your Ashesi account to search availability and submit
              a request.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="min-h-12 w-full max-w-[calc(100vw-2rem)] border border-[color-mix(in_oklch,var(--color-paper-50)_24%,transparent)] bg-[var(--color-paper-50)] px-12 py-3 text-center leading-tight whitespace-normal text-[var(--color-maroon-dark)] shadow-sm hover:bg-[var(--color-maroon-tint)] hover:opacity-100 sm:w-auto"
            asChild
          >
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
