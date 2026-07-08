import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarSearch,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Ticket,
} from "lucide-react";
import type { Booking } from "@cbs/schemas";
import { getSession, serverApi } from "@/lib/api/server";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function AppDashboard() {
  const session = await getSession();
  const api = await serverApi();

  let bookings: Booking[] = [];
  try {
    const { data } = await api.GET("/api/v1/bookings", {
      params: { query: { scope: "mine", limit: 100 } },
    });
    bookings = (data?.data ?? []) as Booking[];
  } catch {
    bookings = [];
  }

  const pending = bookings.filter((b) => b.status === "PENDING");
  const approved = bookings.filter((b) => b.status === "APPROVED");
  const upcoming = approved
    .filter((b) => new Date(b.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);

  const firstName = session?.user.full_name.split(" ")[0] ?? "there";

  const stats = [
    {
      label: "Pending requests",
      value: pending.length,
      icon: Clock,
      tone: "warning" as const,
      subtext: "Waiting for a decision",
    },
    {
      label: "Accepted bookings",
      value: approved.length,
      icon: CheckCircle2,
      tone: "success" as const,
      subtext: "Confirmed rooms in your account",
    },
    {
      label: "Total requests",
      value: bookings.length,
      icon: Ticket,
      tone: "brand" as const,
      subtext: "Every request submitted by you",
    },
  ];

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        description={`Welcome, ${firstName}. Your bookings at a glance.`}
        actions={
          <Button asChild>
            <Link href="/app/search">
              <CalendarSearch className="size-4" /> Book a room
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upcoming accepted bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarSearch}
              title="No upcoming bookings yet"
              description="Accepted future bookings will collect here. Start with live room availability when you need a space."
              action={
                <Button asChild>
                  <Link href="/app/search">
                    <CalendarSearch className="size-4" aria-hidden="true" />
                    Book a room
                  </Link>
                </Button>
              }
              className="border-0 bg-transparent px-4 py-10 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/app/bookings/${b.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-[var(--color-muted)]/40"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {b.room?.name ?? "Room"} · {b.purpose}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {formatDate(b.starts_at)} ·{" "}
                        {formatTimeRange(b.starts_at, b.ends_at)}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
