"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type {
  BookingReport,
  ConflictReport,
  UtilisationReport,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
import { Input } from "@cbs/ui/components/input";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cbs/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cbs/ui/components/table";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Field } from "@/components/forms/field";
import { UtilisationChart, BookingsChart } from "./charts";

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

  function exportUrl(report: string, format: string) {
    const params = new URLSearchParams({ from, to, format });
    return `/api/v1/reports/${report}?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Utilisation, bookings and conflicts. Export large datasets to CSV, Excel or PDF."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <Field id="r-from" label="From" className="w-40">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </Field>
          <Field id="r-to" label="To" className="w-40">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
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
                  <UtilisationChart rows={utilisation.data?.rows ?? []} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Lecture h</TableHead>
                        <TableHead>Booked h</TableHead>
                        <TableHead>Utilisation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(utilisation.data?.rows ?? []).map((r) => (
                        <TableRow key={r.room_id}>
                          <TableCell className="font-medium">{r.room_code}</TableCell>
                          <TableCell>{r.building_name}</TableCell>
                          <TableCell className="tabular-nums">
                            {r.lecture_hours.toFixed(1)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {r.booked_hours.toFixed(1)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {Math.round(r.utilisation_pct)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  { label: "Total", value: bookings.data?.total ?? 0 },
                  { label: "Approved", value: bookings.data?.approved ?? 0 },
                  { label: "Rejected", value: bookings.data?.rejected ?? 0 },
                  {
                    label: "Approval rate",
                    value: `${Math.round(bookings.data?.approval_rate_pct ?? 0)}%`,
                  },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-5">
                      <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                      <p className="text-sm text-[var(--color-muted-foreground)]">
                        {s.label}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Bookings by department</CardTitle>
                </CardHeader>
                <CardContent>
                  <BookingsChart rows={bookings.data?.by_department ?? []} />
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
                  { label: "Rejected requests", value: conflicts.data?.rejected_requests ?? 0 },
                  { label: "Lecture clashes", value: conflicts.data?.lecture_clashes ?? 0 },
                  {
                    label: "Maintenance clashes",
                    value: conflicts.data?.maintenance_clashes ?? 0,
                  },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-5">
                      <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                      <p className="text-sm text-[var(--color-muted-foreground)]">
                        {s.label}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(conflicts.data?.rows ?? []).map((r, i) => (
                        <TableRow key={`${r.date}-${r.room_code}-${i}`}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell className="font-medium">{r.room_code}</TableCell>
                          <TableCell>{r.reason}</TableCell>
                          <TableCell className="tabular-nums">{r.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
