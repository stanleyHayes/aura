"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  DoorOpen,
  Hammer,
  ShieldAlert,
  UserRound,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ApprovalBlocker,
  type BookingApprovability,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Badge } from "@cbs/ui/components/badge";
import { Skeleton } from "@cbs/ui/components/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { useToast } from "@cbs/ui/components/toast";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useSession } from "@/components/session-provider";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProblemAlert } from "@/components/problem-alert";
import { MetricCard } from "@/components/metric-card";
import { RejectDialog } from "./reject-dialog";
import { OverrideDialog } from "./override-dialog";

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

type ApprovalsPage = {
  data: BookingApprovability[];
  next_cursor: string | null;
};

type BookingMetrics = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

const BLOCKER_ICON: Record<ApprovalBlocker["kind"], React.ReactNode> = {
  LECTURE: <CalendarClock className="size-4" />,
  MAINTENANCE: <Hammer className="size-4" />,
  APPROVED_BOOKING: <ShieldAlert className="size-4" />,
  COMPETING_PENDING: <Users className="size-4" />,
  CAPACITY: <Users className="size-4" />,
  IN_PAST: <AlertTriangle className="size-4" />,
};

function RequestDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--color-card)] text-[var(--color-muted-foreground)] shadow-sm">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <dl className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-semibold text-[var(--color-foreground)]">
          {value}
        </dd>
      </dl>
    </div>
  );
}

function WhyPanel({ item }: { item: BookingApprovability }) {
  if (item.can_approve) {
    return (
      <div className="rounded-xl border border-[color-mix(in_oklch,var(--color-approved)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-approved)_8%,transparent)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--color-approved)_16%,transparent)] text-[var(--color-approved)]">
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-approved)]">
              Ready for approval
            </p>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">
              {item.competing_pending_count > 0
                ? `${item.competing_pending_count} other pending request${
                    item.competing_pending_count === 1 ? "" : "s"
                  } compete for this slot. Approving this request will supersede them.`
                : "No lecture, maintenance, capacity, or booking conflicts were detected."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[color-mix(in_oklch,var(--color-rejected)_30%,transparent)] bg-[color-mix(in_oklch,var(--color-rejected)_7%,transparent)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--color-rejected)_14%,transparent)] text-[var(--color-rejected)]">
          <ShieldAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[var(--color-rejected)]">
            Needs attention before approval
          </p>
          <ul className="mt-3 grid gap-2">
            {item.blockers.map((b, i) => (
              <li
                key={`${b.kind}-${i}`}
                className="flex items-start gap-2 rounded-lg bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)]"
              >
                <span
                  className="mt-0.5 text-[var(--color-rejected)]"
                  aria-hidden="true"
                >
                  {BLOCKER_ICON[b.kind]}
                </span>
                <span>
                  {b.message}
                  {b.starts_at && b.ends_at ? (
                    <span className="text-[var(--color-muted-foreground)]">
                      {" "}
                      ({formatTimeRange(b.starts_at, b.ends_at)})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ApprovalMetricsBand({
  metrics,
  loading,
  error,
}: {
  metrics?: BookingMetrics;
  loading: boolean;
  error: unknown;
}) {
  if (loading) {
    return (
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <ProblemAlert error={error} />
      </div>
    );
  }

  const pending = metrics?.pending ?? 0;
  const approved = metrics?.approved ?? 0;
  const rejected = metrics?.rejected ?? 0;
  const decided = approved + rejected;

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Pending requests"
        value={pending.toLocaleString()}
        subtext="Requests waiting for an officer decision."
        icon={Clock3}
        tone="warning"
      />
      <MetricCard
        label="Approved requests"
        value={approved.toLocaleString()}
        subtext={`${decided.toLocaleString()} decided request${decided === 1 ? "" : "s"} so far.`}
        icon={CheckCircle2}
        tone="success"
      />
      <MetricCard
        label="Rejected requests"
        value={rejected.toLocaleString()}
        subtext="Requests declined after review."
        icon={XCircle}
        tone="danger"
      />
    </div>
  );
}

export function ApprovalsClient() {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [overrideId, setOverrideId] = React.useState<string | null>(null);
  const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = React.useState<string[]>([]);

  const canOverride = can("booking.override");

  const metrics = useQuery({
    queryKey: qk.bookingMetrics,
    queryFn: async (): Promise<BookingMetrics> =>
      unwrap(await api.GET("/api/v1/bookings/metrics")),
  });

  const query = useQuery({
    queryKey: qk.approvals({ cursor: cursor ?? null, limit: pageSize }),
    queryFn: async (): Promise<ApprovalsPage> => {
      // The pending scope returns approvability-enriched bookings (§11).
      const page = unwrap(
        await api.GET("/api/v1/bookings", {
          params: { query: { scope: "pending", limit: pageSize, cursor } },
        }),
      );
      // The API enriches pending rows; normalise to BookingApprovability.
      const data = (page.data as unknown[]).map((row) => {
        const maybe = row as Partial<BookingApprovability> & {
          id?: string;
        };
        if (maybe.booking) return maybe as BookingApprovability;
        // Fallback when the API returns plain bookings.
        return {
          booking: row as BookingApprovability["booking"],
          can_approve: true,
          blockers: [],
          competing_pending_count: 0,
        };
      });
      return { data, next_cursor: page.next_cursor ?? null };
    },
    placeholderData: (previous) => previous,
  });

  const approve = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/bookings/{id}/approve", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      setCursor(undefined);
      setCursorStack([]);
      toast({ variant: "success", title: "Booking approved" });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: qk.bookingMetrics });
    },
    onError: (err) =>
      toast({
        variant: "destructive",
        title: "Couldn't approve",
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const items = query.data?.data ?? [];
  const nextCursor = query.data?.next_cursor ?? null;
  const pageIndex = cursorStack.length;
  const firstRow = items.length > 0 ? pageIndex * pageSize + 1 : 0;
  const lastRow = items.length > 0 ? firstRow + items.length - 1 : 0;

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setCursor(undefined);
    setCursorStack([]);
  }

  function goNext() {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, nextCursor]);
    setCursor(nextCursor);
  }

  function goPrevious() {
    const nextStack = cursorStack.slice(0, -1);
    setCursorStack(nextStack);
    setCursor(nextStack.at(-1));
  }

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        title="Approvals queue"
        description="Each request shows exactly why it can — or cannot — be approved, so you can resolve conflicts without guessing."
      />
      <ApprovalMetricsBand
        metrics={metrics.data}
        loading={metrics.isLoading}
        error={metrics.isError ? metrics.error : null}
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : items.length === 0 && cursorStack.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="There are no pending booking requests right now."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No requests on this page"
              description="The queue changed while you were reviewing it. Go back to the previous page to continue."
              actions={
                <Button type="button" variant="outline" onClick={goPrevious}>
                  <ChevronLeft className="size-4" />
                  Previous page
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => {
                const b = item.booking;
                const requesterName = b.requester?.full_name ?? "Unassigned";
                const requesterDepartment = b.requester?.department?.name;
                const requester = requesterDepartment
                  ? `${requesterName} · ${requesterDepartment}`
                  : requesterName;
                const approvingThis =
                  approve.isPending && approve.variables === b.id;
                return (
                  <li key={b.id}>
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col gap-5 p-5 sm:p-6">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 items-start gap-4">
                              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
                                <DoorOpen
                                  className="size-5"
                                  aria-hidden="true"
                                />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                                  Approval request
                                </p>
                                <h3 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-tight text-[var(--color-foreground)]">
                                  {b.room?.name ?? "Room"}
                                </h3>
                                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                                  {b.purpose}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={
                                item.can_approve ? "approved" : "rejected"
                              }
                              className="w-fit px-3 py-1"
                            >
                              {item.can_approve ? "Approvable" : "Blocked"}
                            </Badge>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <RequestDetail
                              icon={CalendarClock}
                              label="Date"
                              value={formatDate(b.starts_at)}
                            />
                            <RequestDetail
                              icon={Clock3}
                              label="Time"
                              value={formatTimeRange(b.starts_at, b.ends_at)}
                            />
                            <RequestDetail
                              icon={Users}
                              label="Attendees"
                              value={`${b.attendee_count} attendee${
                                b.attendee_count === 1 ? "" : "s"
                              }`}
                            />
                            <RequestDetail
                              icon={UserRound}
                              label="Requested by"
                              value={requester}
                            />
                          </div>

                          <WhyPanel item={item} />
                        </div>

                        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_35%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-[var(--color-muted-foreground)]">
                            {item.can_approve
                              ? "No blockers are currently attached to this request."
                              : "Reject the request or use an override if policy allows it."}
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={!item.can_approve || approve.isPending}
                              loading={approvingThis}
                              loadingLabel="Approving request"
                              onClick={() => approve.mutate(b.id)}
                            >
                              <CheckCircle2 className="size-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => setRejectId(b.id)}
                            >
                              <XCircle className="size-4" />
                              Reject
                            </Button>
                            {canOverride && !item.can_approve ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="w-full sm:w-auto"
                                onClick={() => setOverrideId(b.id)}
                              >
                                <ShieldAlert className="size-4" />
                                Override
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Showing{" "}
              <span className="font-medium tabular-nums text-[var(--color-foreground)]">
                {firstRow}
              </span>
              {" - "}
              <span className="font-medium tabular-nums text-[var(--color-foreground)]">
                {lastRow}
              </span>
              <span className="ml-2 text-xs">
                Page {pageIndex + 1}
              </span>
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
                <span>Requests per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger
                    aria-label="Requests per page"
                    className="h-9 w-[5rem] bg-[var(--color-card)]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goPrevious}
                  disabled={cursorStack.length === 0 || query.isFetching}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={!nextCursor || query.isFetching}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RejectDialog
        bookingId={rejectId}
        onOpenChange={(open) => !open && setRejectId(null)}
      />
      <OverrideDialog
        bookingId={overrideId}
        onOpenChange={(open) => !open && setOverrideId(null)}
      />
    </>
  );
}
