import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DoorOpen,
  FileBarChart,
  LayoutDashboard,
  Percent,
  PieChart,
  Plus,
  Upload,
  Users,
  Wrench,
} from "lucide-react";
import type { Booking } from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cbs/ui/components/card";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PageHelp } from "@/components/page-help";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusBadge } from "@/components/status-badge";
import { getSession, serverApi } from "@/lib/api/server";
import { apiOrigin } from "@/lib/env";
import { route } from "@/lib/route";
import {
  CategoryBarChart,
  PeakHoursChart,
  SeriesChart,
  StatusBreakdownChart,
  TopRoomsChart,
} from "./overview-charts";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

/** Snake-case shape returned by GET /api/v1/reports/overview. This path is not
 *  yet part of the generated @cbs/api-client contract, so we type it locally and
 *  fetch it directly (forwarding cookies the same way serverApi does). */
type LabelCount = { label: string; count: number };
type OverviewReport = {
  range: { from: string; to: string };
  kpis: {
    total_bookings: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    expired: number;
    active_rooms: number;
    active_users: number;
    buildings: number;
    avg_utilisation_pct: number;
    approval_rate_pct: number;
  };
  status_breakdown: LabelCount[];
  by_room_type: LabelCount[];
  by_building: LabelCount[];
  top_rooms: {
    room_code: string;
    room_name: string;
    utilisation_pct: number;
    booked_hours: number;
  }[];
  series: { date: string; submitted: number; approved: number }[];
  peak_hours: { hour: number; count: number }[];
};

const dashboardTitle = "Overview";
const dashboardDescription =
  "An at-a-glance view of bookings, approvals, utilisation and demand across the institution.";
const dashboardGuide = [
  "Start with the KPI tiles for the headline numbers across the last 30 days.",
  "Read the activity trend and status split to see how requests are flowing.",
  "Use the room-type, building and peak-hour charts to find demand hotspots.",
  "Quick actions cover the common admin jobs your role can access.",
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Fetch the overview report directly. The generated client only knows the
 *  documented paths, and /reports/overview is being added in parallel, so we
 *  hit the API origin and forward the inbound cookies + CSRF exactly like
 *  serverApi() does. Returns the parsed report or throws on a non-2xx. */
async function fetchOverview(from: string, to: string): Promise<OverviewReport> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const csrf =
    cookieStore.get("cbs_csrf")?.value ?? cookieStore.get("cbs-csrf")?.value;

  const headers: Record<string, string> = { accept: "application/json" };
  if (cookieHeader) headers.cookie = cookieHeader;
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const url = `${apiOrigin}/api/v1/reports/overview?from=${encodeURIComponent(
    from,
  )}&to=${encodeURIComponent(to)}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Overview report request failed (HTTP ${res.status}).`);
  }
  return (await res.json()) as OverviewReport;
}

export default async function AdminDashboard() {
  const session = await getSession();
  const api = await serverApi();

  const permissions = new Set(session?.permissions ?? []);
  const canApprove = permissions.has("booking.approve");
  const canReport = permissions.has("report.view");
  const canManageRooms = permissions.has("room.manage");
  const canManageTimetable = permissions.has("timetable.manage");
  const canManageMaintenance = permissions.has("maintenance.manage");

  let pending: Booking[] = [];
  if (canApprove) {
    try {
      const { data } = await api.GET("/api/v1/bookings", {
        params: { query: { scope: "pending", limit: 50 } },
      });
      // scope=pending now returns approvability-enriched rows ({ booking, ... });
      // normalise to the plain booking (also tolerant of the old plain shape).
      pending = ((data?.data ?? []) as unknown[]).map((row) => {
        const r = row as { booking?: Booking };
        return (r.booking ?? (row as Booking)) as Booking;
      });
    } catch {
      pending = [];
    }
  }

  const from = isoDaysAgo(30);
  const to = isoDaysAgo(0);

  let overview: OverviewReport | null = null;
  let overviewError: unknown = null;
  if (canReport) {
    try {
      overview = await fetchOverview(from, to);
    } catch (error) {
      overviewError = error;
      overview = null;
    }
  }

  const kpis = overview?.kpis;
  const stats = [
    {
      label: "Total bookings",
      value: kpis ? kpis.total_bookings.toLocaleString() : "—",
      subtext: "Requests in the last 30 days",
      icon: CalendarRange,
      href: "/admin/reports",
      tone: "brand" as const,
      show: canReport,
    },
    {
      label: "Pending",
      value: canApprove
        ? pending.length
        : kpis
          ? kpis.pending.toLocaleString()
          : "—",
      subtext: "Requests awaiting review",
      icon: ClipboardCheck,
      href: canApprove ? "/admin/approvals" : "/admin/reports",
      tone: "warning" as const,
      show: canApprove || canReport,
    },
    {
      label: "Approved",
      value: kpis ? kpis.approved.toLocaleString() : "—",
      subtext: "Accepted by the review flow",
      icon: CheckCircle2,
      href: "/admin/reports",
      tone: "success" as const,
      show: canReport,
    },
    {
      label: "Approval rate",
      value: kpis ? `${Math.round(kpis.approval_rate_pct)}%` : "—",
      subtext: "Approved share of decided requests",
      icon: PieChart,
      href: "/admin/reports",
      tone: "info" as const,
      show: canReport,
    },
    {
      label: "Avg utilisation",
      value: kpis ? `${Math.round(kpis.avg_utilisation_pct)}%` : "—",
      subtext: "Average booked and lecture usage",
      icon: Percent,
      href: "/admin/reports",
      tone: "booking" as const,
      show: canReport,
    },
    {
      label: "Active rooms",
      value: kpis ? kpis.active_rooms.toLocaleString() : "—",
      subtext: `${kpis ? kpis.buildings.toLocaleString() : "—"} buildings`,
      icon: DoorOpen,
      href: "/admin/rooms",
      tone: "brand" as const,
      show: canReport,
    },
    {
      label: "Active users",
      value: kpis ? kpis.active_users.toLocaleString() : "—",
      subtext: "People who booked in range",
      icon: Users,
      href: "/admin/reports",
      tone: "neutral" as const,
      show: canReport,
    },
  ].filter((item) => item.show);

  const primaryAction = canManageRooms
    ? { href: "/admin/rooms", label: "Add room", icon: Plus }
    : canApprove
      ? { href: "/admin/approvals", label: "Review approvals", icon: ClipboardCheck }
      : null;
  const PrimaryActionIcon = primaryAction?.icon;

  const quickActions = [
    {
      href: "/admin/rooms",
      label: "Add room",
      description: "Create or update spaces in the catalogue.",
      icon: Plus,
      show: canManageRooms,
    },
    {
      href: "/admin/timetable",
      label: "Upload timetable",
      description: "Refresh the semester timetable feed.",
      icon: Upload,
      show: canManageTimetable,
    },
    {
      href: "/admin/reports",
      label: "Run report",
      description: "Inspect utilisation, bookings and conflicts.",
      icon: FileBarChart,
      show: canReport,
    },
    {
      href: "/admin/maintenance",
      label: "Schedule maintenance",
      description: "Block rooms and equipment for service windows.",
      icon: Wrench,
      show: canManageMaintenance,
    },
  ].filter((action) => action.show);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={dashboardTitle}
        description={dashboardDescription}
        help={
          <PageHelp
            pageTitle={dashboardTitle}
            description={dashboardDescription}
            steps={dashboardGuide}
          />
        }
        actions={
          primaryAction ? (
            <Button asChild>
              <Link href={route(primaryAction.href)}>
                {PrimaryActionIcon ? (
                  <PrimaryActionIcon className="size-4" aria-hidden="true" />
                ) : null}
                {primaryAction.label}
              </Link>
            </Button>
          ) : null
        }
      />

      {canReport && overviewError ? (
        <div className="mb-6">
          <ProblemAlert error={overviewError} />
        </div>
      ) : null}

      {stats.length > 0 ? (
        <section aria-labelledby="admin-dashboard-kpis">
          <h2 id="admin-dashboard-kpis" className="sr-only">
            Admin dashboard key metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <MetricCard key={stat.label} {...stat} />
            ))}
          </div>
        </section>
      ) : null}

      {canReport ? (
        <section
          className="mt-6 grid gap-6"
          aria-labelledby="admin-dashboard-charts"
        >
          <h2 id="admin-dashboard-charts" className="sr-only">
            Booking and utilisation charts
          </h2>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Activity trend</CardTitle>
                <CardDescription>
                  Submitted vs approved bookings per day over the last 30 days.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={route("/admin/reports")}>Open reports</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <SeriesChart series={overview?.series ?? []} />
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Status breakdown</CardTitle>
                <CardDescription>
                  How requests in the range resolved across the workflow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBreakdownChart data={overview?.status_breakdown ?? []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bookings by room type</CardTitle>
                <CardDescription>
                  Which kinds of space are in demand.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBarChart
                  data={overview?.by_room_type ?? []}
                  emptyTitle="No room-type data for this range"
                  emptyDescription="Bookings grouped by room type appear once requests fall inside the selected dates."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top rooms by utilisation</CardTitle>
                <CardDescription>
                  The most-used rooms over the last 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopRoomsChart rooms={overview?.top_rooms ?? []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak hours</CardTitle>
                <CardDescription>
                  When demand concentrates across the day (00:00–23:00).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PeakHoursChart hours={overview?.peak_hours ?? []} />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Bookings by building</CardTitle>
                <CardDescription>
                  Where bookings cluster across campus.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBarChart
                  data={overview?.by_building ?? []}
                  emptyTitle="No building data for this range"
                  emptyDescription="Bookings grouped by building appear once requests fall inside the selected dates."
                />
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {quickActions.length > 0 || canApprove ? (
        <section
          className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
          aria-labelledby="admin-dashboard-actions"
        >
          <h2 id="admin-dashboard-actions" className="sr-only">
            Quick actions and pending approvals
          </h2>

          {quickActions.length > 0 ? (
            <div>
              <div className="mb-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  Quick actions
                </h3>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Shortcuts for the work your role can perform.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map(({ href, label, description, icon: Icon }) => (
                  <Link
                    key={href}
                    href={route(href)}
                    className="group flex min-h-28 items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  >
                    <span>
                      <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-[var(--color-foreground)]">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--color-muted-foreground)]">
                        {description}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {canApprove ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Awaiting your review</CardTitle>
                  <CardDescription>
                    Pending requests that need a decision.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={route("/admin/approvals")}>Open queue</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No approvals pending"
                    description="The queue is clear. New requests will appear here when departments submit them."
                    className="border-0 bg-transparent px-4 py-8 shadow-none"
                  />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {pending.slice(0, 6).map((booking) => (
                      <li
                        key={booking.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {booking.room?.name ?? "Room"} · {booking.purpose}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                            <Clock className="size-3" aria-hidden="true" />
                            {formatDate(booking.starts_at)} ·{" "}
                            {formatTimeRange(booking.starts_at, booking.ends_at)} ·
                            by {booking.requester?.full_name ?? "requester"}
                          </p>
                        </div>
                        <StatusBadge status={booking.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
