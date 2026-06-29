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
  const buildingList: Building[] = React.useMemo(
    () => buildings.data ?? [],
    [buildings.data],
  );
  // The calendar endpoint requires a room_id or building_id (§8.3). Until the
  // user picks one, default to the first building from the reference list.
  const [selected, setSelected] = React.useState<string>("");
  const buildingId =
    selected || (buildingList.length > 0 ? buildingList[0]!.id : "");

  const query = useQuery({
    queryKey: qk.calendar({ buildingId, view: "week" }),
    enabled: buildingId !== "",
    queryFn: async (): Promise<CalendarBlock[]> => {
      const res = unwrap(
        await api.GET("/api/v1/calendar", {
          params: {
            query: {
              view: "week",
              date: todayKey(),
              building_id: buildingId,
            },
          },
        }),
      );
      return (res.data ?? []) as CalendarBlock[];
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="cal-building">
          Building
        </label>
        <div className="w-64">
          <Select
            value={buildingId || undefined}
            onValueChange={setSelected}
          >
            <SelectTrigger id="cal-building">
              <SelectValue placeholder="Select a building" />
            </SelectTrigger>
            <SelectContent>
              {buildingList.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isError ? (
        <ProblemAlert error={query.error} />
      ) : query.isPending || buildingId === "" ? (
        <Skeleton className="h-[32rem] w-full rounded-xl" />
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
