"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Building, CalendarBlock } from "@cbs/schemas";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Skeleton } from "@cbs/ui/components/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useBuildings } from "@/lib/hooks/reference";
import { ProblemAlert } from "@/components/problem-alert";
import { CalendarView } from "@/components/calendar-view";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Building-scoped calendar panel reused in app + admin (§7.7, FR10). */
export function CalendarPanel() {
  const buildings = useBuildings();
  const [buildingId, setBuildingId] = React.useState<string>("");

  const query = useQuery({
    queryKey: qk.calendar({ buildingId, view: "week" }),
    queryFn: async (): Promise<CalendarBlock[]> => {
      const res = unwrap(
        await api.GET("/api/v1/calendar", {
          params: {
            query: {
              view: "week",
              date: todayKey(),
              building_id: buildingId || undefined,
            },
          },
        }),
      );
      return (res.blocks ?? []) as CalendarBlock[];
    },
  });

  const buildingList: Building[] = buildings.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="cal-building">
          Building
        </label>
        <div className="w-64">
          <Select
            value={buildingId || "any"}
            onValueChange={(v) => setBuildingId(v === "any" ? "" : v)}
          >
            <SelectTrigger id="cal-building">
              <SelectValue placeholder="All buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All buildings</SelectItem>
              {buildingList.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <Card>
          <CardContent className="p-3">
            <CalendarView blocks={query.data ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
