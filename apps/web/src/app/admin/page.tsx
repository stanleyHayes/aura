import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, DoorOpen, Percent, TriangleAlert } from "lucide-react";
import type { Booking, UtilisationReport } from "@cbs/schemas";
import { getSession, serverApi } from "@/lib/api/server";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { route } from "@/lib/route";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboard() {
  const session = await getSession();
  const api = await serverApi();

  const canApprove = session?.permissions.includes("booking.approve") ?? false;
  const canReport = session?.permissions.includes("report.view") ?? false;

  let pending: Booking[] = [];
  if (canApprove) {
    try {
      const { data } = await api.GET("/api/v1/bookings", {
        params: { query: { scope: "pending", limit: 50 } },
      });
      pending = (data?.data ?? []) as Booking[];
    } catch {
      pending = [];
    }
  }

  let utilisation: UtilisationReport | null = null;
  if (canReport) {
    try {
      const { data } = await api.GET("/api/v1/reports/utilisation", {
        params: { query: { from: isoDaysAgo(30), to: isoDaysAgo(0) } },
      });
      utilisation = (data as UtilisationReport | undefined) ?? null;
    } catch {
      utilisation = null;
    }
  }

  const stats = [
    {
      label: "Pending approvals",
      value: pending.length,
      icon: ClipboardCheck,
      href: "/admin/approvals",
      show: canApprove,
    },
    {
      label: "30-day utilisation",
      value: utilisation
        ? `${Math.round(utilisation.average_utilisation_pct)}%`
        : "—",
      icon: Percent,
      href: "/admin/reports",
      show: canReport,
    },
    {
      label: "Rooms tracked",
      value: utilisation ? (utilisation.rooms?.length ?? 0) : "—",
      icon: DoorOpen,
      href: "/admin/rooms",
      show: canReport,
    },
  ].filter((s) => s.show);

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="A snapshot of approvals and utilisation across the institution."
      />

      {stats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={route(href)}>
              <Card className="transition-shadow hover:shadow-md">
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
            </Link>
          ))}
        </div>
      ) : null}

      {canApprove ? (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Awaiting your review</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/approvals">Open approvals queue</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-sm text-[var(--color-muted-foreground)]">
                <TriangleAlert className="size-4" /> Nothing pending. You&apos;re
                all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {pending.slice(0, 6).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {b.room?.name ?? "Room"} · {b.purpose}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {formatDate(b.starts_at)} ·{" "}
                        {formatTimeRange(b.starts_at, b.ends_at)} · by{" "}
                        {b.requester?.full_name ?? "requester"}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
