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
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";

export const metadata: Metadata = {
  title: "Dashboard",
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
    { label: "Pending requests", value: pending.length, icon: Clock },
    { label: "Approved bookings", value: approved.length, icon: CheckCircle2 },
    { label: "Total requests", value: bookings.length, icon: Ticket },
  ];

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome, ${firstName}`}
        description="Your bookings at a glance."
        actions={
          <Button asChild>
            <Link href="/app/search">
              <CalendarSearch className="size-4" /> Find a room
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-11 place-items-center rounded-lg bg-[var(--color-ink-100)] text-[var(--color-ink-700)]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upcoming approved bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              No upcoming bookings yet.{" "}
              <Link href="/app/search" className="text-[var(--color-primary)] hover:underline">
                Find a room
              </Link>
              .
            </p>
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
