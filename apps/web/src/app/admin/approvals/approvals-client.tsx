"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Hammer,
  ShieldAlert,
  Users,
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
import { Separator } from "@cbs/ui/components/separator";
import { useToast } from "@cbs/ui/components/toast";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useSession } from "@/components/session-provider";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProblemAlert } from "@/components/problem-alert";
import { RejectDialog } from "./reject-dialog";
import { OverrideDialog } from "./override-dialog";

const BLOCKER_ICON: Record<ApprovalBlocker["kind"], React.ReactNode> = {
  LECTURE: <CalendarClock className="size-4" />,
  MAINTENANCE: <Hammer className="size-4" />,
  APPROVED_BOOKING: <ShieldAlert className="size-4" />,
  COMPETING_PENDING: <Users className="size-4" />,
  CAPACITY: <Users className="size-4" />,
  IN_PAST: <AlertTriangle className="size-4" />,
};

function WhyPanel({ item }: { item: BookingApprovability }) {
  if (item.can_approve) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_oklch,var(--color-approved)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-approved)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-approved)]">
        <CheckCircle2 className="size-4" />
        <span>
          Clear to approve.
          {item.competing_pending_count > 0
            ? ` ${item.competing_pending_count} other pending request${
                item.competing_pending_count === 1 ? "" : "s"
              } compete for this slot — approving this one will supersede them.`
            : " No conflicts detected."}
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[color-mix(in_oklch,var(--color-rejected)_30%,transparent)] bg-[color-mix(in_oklch,var(--color-rejected)_6%,transparent)] p-3">
      <p className="mb-2 text-sm font-medium text-[var(--color-rejected)]">
        Cannot be approved as-is:
      </p>
      <ul className="flex flex-col gap-1.5">
        {item.blockers.map((b, i) => (
          <li
            key={`${b.kind}-${i}`}
            className="flex items-start gap-2 text-sm text-[var(--color-foreground)]"
          >
            <span className="mt-0.5 text-[var(--color-rejected)]" aria-hidden="true">
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
  );
}

export function ApprovalsClient() {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [overrideId, setOverrideId] = React.useState<string | null>(null);

  const canOverride = can("booking.override");

  const query = useQuery({
    queryKey: qk.approvals(),
    queryFn: async (): Promise<BookingApprovability[]> => {
      // The pending scope returns approvability-enriched bookings (§11).
      const page = unwrap(
        await api.GET("/api/v1/bookings", {
          params: { query: { scope: "pending", limit: 100 } },
        }),
      );
      // The API enriches pending rows; normalise to BookingApprovability.
      return (page.data as unknown[]).map((row) => {
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
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/bookings/{id}/approve", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      toast({ variant: "success", title: "Booking approved" });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (err) =>
      toast({
        variant: "destructive",
        title: "Couldn't approve",
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const items = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Approvals queue"
        description="Each request shows exactly why it can — or cannot — be approved, so you can resolve conflicts without guessing."
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="There are no pending booking requests right now."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const b = item.booking;
            return (
              <li key={b.id}>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-lg tracking-tight">
                          {b.room?.name ?? "Room"} — {b.purpose}
                        </h3>
                        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                          {formatDate(b.starts_at)} ·{" "}
                          {formatTimeRange(b.starts_at, b.ends_at)} ·{" "}
                          {b.attendee_count} attendee
                          {b.attendee_count === 1 ? "" : "s"}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                          Requested by {b.requester?.full_name ?? "—"}
                          {b.requester?.department?.name
                            ? ` · ${b.requester.department.name}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={item.can_approve ? "approved" : "rejected"}>
                        {item.can_approve ? "Approvable" : "Blocked"}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <WhyPanel item={item} />
                    </div>

                    <Separator className="my-4" />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!item.can_approve || approve.isPending}
                        onClick={() => approve.mutate(b.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectId(b.id)}
                      >
                        Reject
                      </Button>
                      {canOverride && !item.can_approve ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setOverrideId(b.id)}
                        >
                          Override &amp; approve
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
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
