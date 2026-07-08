"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Download,
  DoorOpen,
  FileBarChart,
  Percent,
  TimerOff,
  XCircle,
} from "lucide-react";
import type {
  BookingReport,
  ConflictReport,
  UtilisationReport,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cbs/ui/components/tabs";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useDepartments } from "@/lib/hooks/reference";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/date-picker";
import { MetricCard } from "@/components/metric-card";
import { UtilisationChart, BookingsChart } from "./charts";

type UtilisationRow = UtilisationReport["rooms"][number];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportsClient() {
  const [from, setFrom] = React.useState(isoDaysAgo(30));
  const [to, setTo] = React.useState(isoDaysAgo(0));

  const filter = { from, to };

  const utilisation = useQuery({
    queryKey: qk.reportUtilisation(filter),
    queryFn: async (): Promise<UtilisationReport> =>
      unwrap(
        await api.GET("/api/v1/reports/utilisation", {
          params: { query: filter },
        }),
      ),
  });

  const bookings = useQuery({
    queryKey: qk.reportBookings(filter),
    queryFn: async (): Promise<BookingReport> =>
      unwrap(
        await api.GET("/api/v1/reports/bookings", { params: { query: filter } }),
      ),
  });

  const conflicts = useQuery({
    queryKey: qk.reportConflicts(filter),
    queryFn: async (): Promise<ConflictReport> =>
      unwrap(
        await api.GET("/api/v1/reports/conflicts", { params: { query: filter } }),
      ),
  });

  // Department booking totals are keyed by department code; map codes to names
  // so the bookings chart shows recognizable labels instead of raw codes.
  const departments = useDepartments();
  const departmentLabels = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departments.data ?? []) map[d.code] = d.name;
    return map;
  }, [departments.data]);

  function exportUrl(report: string, format: string) {
    const params = new URLSearchParams({ from, to, format });
    return `/api/v1/reports/${report}?${params.toString()}`;
  }

  function resetRange() {
    setFrom(isoDaysAgo(30));
    setTo(isoDaysAgo(0));
  }

  const utilisationColumns = React.useMemo<ColumnDef<UtilisationRow>[]>(
    () => [
      {
        accessorKey: "room_name",
        header: "Room",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.room_name}</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {row.original.room_code}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "capacity",
        header: "Capacity",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.capacity}</span>
        ),
      },
      {
        accessorKey: "lecture_hours",
        header: "Lecture h",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.lecture_hours.toFixed(1)}
          </span>
        ),
      },
      {
        accessorKey: "booked_hours",
        header: "Booked h",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.booked_hours.toFixed(1)}
          </span>
        ),
      },
      {
        accessorKey: "utilisation_pct",
        header: "Utilisation",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Math.round(row.original.utilisation_pct)}%
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        description="Utilisation, bookings and conflicts. Export large datasets to CSV, Excel or PDF."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <Field id="r-from" label="From" className="w-44">
            {(p) => (
              <DatePicker id={p.id} value={from} onChange={setFrom} />
            )}
          </Field>
          <Field id="r-to" label="To" className="w-44">
            {(p) => (
              <DatePicker
                id={p.id}
                align="end"
                min={from || undefined}
                value={to}
                onChange={setTo}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Tabs defaultValue="utilisation">
        <TabsList>
          <TabsTrigger value="utilisation">Utilisation</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
        </TabsList>

        {/* Utilisation */}
        <TabsContent value="utilisation">
          {utilisation.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : utilisation.isError ? (
            <ProblemAlert error={utilisation.error} />
          ) : (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Room utilisation</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <a href={exportUrl("utilisation", "csv")} download>
                      <Download className="size-4" /> Export CSV
                    </a>
                  </Button>
                </CardHeader>
                <CardContent>
                  <UtilisationChart
                    rows={utilisation.data?.rooms ?? []}
                    emptyActions={
                      <Button type="button" onClick={resetRange}>
                        Reset range
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <DataTable
                    columns={utilisationColumns}
                    data={utilisation.data?.rooms ?? []}
                    caption="Room utilisation"
                    emptyIcon={DoorOpen}
                    emptyTitle="No utilisation rows"
                    emptyDescription="No rooms have utilisation data for this range. Try the default 30-day window or upload timetable data."
                    emptyActions={
                      <Button type="button" onClick={resetRange}>
                        Reset range
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Bookings */}
        <TabsContent value="bookings">
          {bookings.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : bookings.isError ? (
            <ProblemAlert error={bookings.error} />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  {
                    label: "Total requests",
                    value: bookings.data?.total_requests ?? 0,
                    icon: ClipboardList,
                    tone: "brand" as const,
                    subtext: "Submitted in the selected range",
                  },
                  {
                    label: "Accepted",
                    value: bookings.data?.by_status?.APPROVED ?? 0,
                    icon: CheckCircle2,
                    tone: "success" as const,
                    subtext: "Accepted by the review flow",
                  },
                  {
                    label: "Rejected",
                    value: bookings.data?.by_status?.REJECTED ?? 0,
                    icon: XCircle,
                    tone: "danger" as const,
                    subtext: "Declined after review",
                  },
                  {
                    label: "Acceptance rate",
                    value: `${Math.round(bookings.data?.approval_rate_pct ?? 0)}%`,
                    icon: Percent,
                    tone: "info" as const,
                    subtext: "Accepted share of requests",
                  },
                ].map((s) => (
                  <MetricCard key={s.label} {...s} />
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Bookings by department</CardTitle>
                </CardHeader>
                <CardContent>
                  <BookingsChart
                    data={bookings.data?.by_department ?? {}}
                    labels={departmentLabels}
                    emptyActions={
                      <Button type="button" onClick={resetRange}>
                        Reset range
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Conflicts */}
        <TabsContent value="conflicts">
          {conflicts.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : conflicts.isError ? (
            <ProblemAlert error={conflicts.error} />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: "Rejected requests",
                    value: conflicts.data?.rejected_requests ?? 0,
                    icon: XCircle,
                    tone: "danger" as const,
                    subtext: "Requests stopped by review",
                  },
                  {
                    label: "Cancelled bookings",
                    value: conflicts.data?.cancelled_bookings ?? 0,
                    icon: Ban,
                    tone: "neutral" as const,
                    subtext: "Bookings withdrawn after acceptance",
                  },
                  {
                    label: "Expired requests",
                    value: conflicts.data?.expired_requests ?? 0,
                    icon: TimerOff,
                    tone: "warning" as const,
                    subtext: "Requests that aged out",
                  },
                ].map((s) => (
                  <MetricCard key={s.label} {...s} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
