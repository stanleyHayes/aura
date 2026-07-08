"use client";

import * as React from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  BOOKING_STATUS_LABELS,
  BookingStatus,
  type Booking,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Skeleton } from "@cbs/ui/components/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@cbs/ui/components/tabs";
import { formatDate, formatTimeRange } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusBadge } from "@/components/status-badge";
import { CancelDialog } from "@/components/cancel-dialog";

const FILTERS = ["all", ...BookingStatus.options] as const;
type Filter = (typeof FILTERS)[number];

export function MyBookingsClient() {
  const [filter, setFilter] = React.useState<Filter>("all");

  const query = useQuery({
    queryKey: qk.bookings({ scope: "mine" }),
    queryFn: async (): Promise<Booking[]> => {
      const page = unwrap(
        await api.GET("/api/v1/bookings", {
          params: { query: { scope: "mine", limit: 200 } },
        }),
      );
      return page.data as Booking[];
    },
  });

  const [cancelId, setCancelId] = React.useState<string | null>(null);

  const all = query.data ?? [];
  const visible =
    filter === "all" ? all : all.filter((b) => b.status === filter);

  return (
    <>
      <PageHeader
        icon={Ticket}
        title="My bookings"
        description="Track the status of every request you've made."
        actions={
          <Button asChild>
            <Link href="/app/search">Book a room</Link>
          </Button>
        }
      />

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
        className="mb-4"
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {BookingStatus.options.map((s) => (
            <TabsTrigger key={s} value={s}>
              {BOOKING_STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <CancelDialog
        bookingId={cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No bookings here"
          description="When you submit a request it will appear in this list with its live status."
          action={
            <Button asChild>
              <Link href="/app/search">Book a room</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <Link
                    href={`/app/bookings/${b.id}`}
                    className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  >
                    <p className="truncate font-medium">
                      {b.room?.name ?? "Room"} — {b.purpose}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                      {formatDate(b.starts_at)} ·{" "}
                      {formatTimeRange(b.starts_at, b.ends_at)} ·{" "}
                      {b.attendee_count} attendee
                      {b.attendee_count === 1 ? "" : "s"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={b.status} />
                    {(b.status === "PENDING" || b.status === "APPROVED") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelId(b.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
