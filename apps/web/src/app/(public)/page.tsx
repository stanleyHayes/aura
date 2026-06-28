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

export const metadata: Metadata = {
  title: "University Classroom Booking",
  description:
    "Search real-time classroom availability derived from the live semester timetable, request rooms, and let booking officers approve with full conflict visibility.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Roomwise — University Classroom Booking",
    description:
      "Search availability, request rooms, and manage the timetable in one place.",
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
    title: "Approvals with reasons",
    body: "Booking officers see precisely why a request can or cannot be approved — competing requests, maintenance, or capacity.",
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklch,var(--color-ink-300)_28%,transparent),transparent)]"
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
              For lecturers, coordinators &amp; student organisations
            </p>
            <h1 className="text-balance font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Find a free room in seconds. Book it without the back-and-forth.
            </h1>
            <p className="mt-5 text-pretty text-lg text-[var(--color-muted-foreground)]">
              Roomwise computes real-time classroom availability from the live
              semester timetable, ad-hoc bookings and maintenance windows — then
              runs a transparent approval workflow on top.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Sign in to book</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/rooms">Browse the room directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="font-serif text-2xl tracking-tight">
          Built around how rooms are really used
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
          Lecture occupancy and booking occupancy are kept separate, so
          replacing a semester timetable never disturbs existing bookings.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="h-full">
              <CardContent className="flex flex-col gap-3 p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-ink-100)] text-[var(--color-ink-700)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-serif text-lg tracking-tight">{title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-ink-900)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-serif text-2xl tracking-tight text-[var(--color-paper-50)]">
              Ready to reserve a room?
            </h2>
            <p className="mt-2 text-[color-mix(in_oklch,var(--color-paper-50)_80%,transparent)]">
              Sign in with your university account to search availability and
              submit a request.
            </p>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
