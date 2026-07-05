"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  Hammer,
  Layers3,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import type { Building, CalendarBlock, Room } from "@cbs/schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cbs/ui/components/card";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useBuildings } from "@/lib/hooks/reference";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { ProblemAlert } from "@/components/problem-alert";
import { CalendarView } from "@/components/calendar-view";
import { IconWatermark } from "@/components/watermark";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const SOURCE_LEGEND = [
  {
    source: "LECTURE",
    label: "Lectures",
    icon: CalendarClock,
    tone: "var(--color-lecture)",
  },
  {
    source: "BOOKING",
    label: "Bookings",
    icon: ShieldCheck,
    tone: "var(--color-booking)",
  },
  {
    source: "MAINTENANCE",
    label: "Maintenance",
    icon: Hammer,
    tone: "var(--color-maintenance)",
  },
  {
    source: "AVAILABLE",
    label: "Available",
    icon: CheckCircle2,
    tone: "var(--color-approved)",
  },
] as const;

function buildingOptions(buildings: Building[]): ComboboxOption[] {
  return buildings.map((building) => ({
    value: building.id,
    label: building.name,
    description: [building.code, building.campus].filter(Boolean).join(" · "),
    keywords: building.campus ?? "",
  }));
}

function roomOptions(rooms: Room[]): ComboboxOption[] {
  return rooms.map((room) => ({
    value: room.id,
    label: room.name,
    description: room.room_code,
    keywords: room.room_code,
  }));
}

/** Building-scoped calendar panel reused in app + admin (§7.7, FR10). */
export function CalendarPanel() {
  const buildings = useBuildings();
  const buildingList: Building[] = React.useMemo(
    () => buildings.data ?? [],
    [buildings.data],
  );
  // Default to the first building from the reference list until one is picked.
  const [selected, setSelected] = React.useState<string>("");
  const buildingId =
    selected || (buildingList.length > 0 ? buildingList[0]!.id : "");

  // Rooms in the selected building. The calendar shows ONE room at a time — a
  // Schedule-X day/week grid can't separate resources, so a building-wide feed
  // piles every room's lectures and available gaps on top of each other.
  const roomsQuery = useQuery({
    queryKey: qk.rooms({ buildingId, scope: "calendar" }),
    enabled: buildingId !== "",
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Room[]> => {
      const page = unwrap(
        await api.GET("/api/v1/rooms", {
          params: { query: { building_id: buildingId, limit: 200 } },
        }),
      );
      return page.data as Room[];
    },
  });
  const roomList = React.useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const [selectedRoom, setSelectedRoom] = React.useState<string>("");
  // Use the chosen room if it still belongs to the building, else the first one.
  const roomId =
    selectedRoom && roomList.some((r) => r.id === selectedRoom)
      ? selectedRoom
      : roomList.length > 0
        ? roomList[0]!.id
        : "";

  const query = useQuery({
    queryKey: qk.calendar({ roomId, view: "week" }),
    enabled: roomId !== "",
    queryFn: async (): Promise<CalendarBlock[]> => {
      const res = unwrap(
        await api.GET("/api/v1/calendar", {
          params: {
            query: {
              view: "week",
              date: todayKey(),
              room_id: roomId,
            },
          },
        }),
      );
      return (res.data ?? []) as CalendarBlock[];
    },
  });
  const blocks = React.useMemo(() => query.data ?? [], [query.data]);
  const counts = React.useMemo(
    () =>
      blocks.reduce<Record<CalendarBlock["source"], number>>(
        (acc, block) => {
          acc[block.source] += 1;
          return acc;
        },
        { LECTURE: 0, BOOKING: 0, MAINTENANCE: 0, AVAILABLE: 0 },
      ),
    [blocks],
  );
  return (
    <div className="flex flex-col gap-5">
      <Card className="relative overflow-hidden">
        <IconWatermark
          icon={Layers3}
          className="-right-8 -top-10 size-44 rotate-[-8deg]"
        />
        <CardContent className="relative p-4 sm:p-5">
          {/* Header row: title + description (left), building picker (right). */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklch,var(--color-maroon)_20%,var(--color-border))] bg-[var(--color-maroon-tint)] text-[var(--color-maroon)] dark:bg-[color-mix(in_oklch,var(--color-maroon)_24%,var(--color-card))] dark:text-[var(--color-maroon-tint)]">
                <Layers3 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
                  Campus schedule layer
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
                  Pick a building and room to scan its lectures, bookings,
                  maintenance, and available gaps on one live timeline.
                </p>
              </div>
            </div>

            <div className="grid w-full shrink-0 gap-3 sm:grid-cols-2 lg:w-[34rem]">
              <div>
                <label
                  className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
                  htmlFor="cal-building"
                >
                  <MapPinned className="size-3.5" aria-hidden="true" />
                  Building
                </label>
                <Combobox
                  id="cal-building"
                  value={buildingId}
                  onValueChange={(v) => {
                    setSelected(v);
                    setSelectedRoom("");
                  }}
                  placeholder="Select a building"
                  searchPlaceholder="Search buildings by name or code"
                  emptyText="No buildings match your search."
                  align="end"
                  options={buildingOptions(buildingList)}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
                  htmlFor="cal-room"
                >
                  <DoorOpen className="size-3.5" aria-hidden="true" />
                  Room
                </label>
                <Combobox
                  id="cal-room"
                  value={roomId}
                  onValueChange={setSelectedRoom}
                  placeholder={
                    roomsQuery.isLoading ? "Loading rooms…" : "Select a room"
                  }
                  searchPlaceholder="Search rooms by name or code"
                  emptyText="No rooms in this building."
                  align="end"
                  options={roomOptions(roomList)}
                />
              </div>
            </div>
          </div>

          {/* Source counts: even full-width row that never clips. */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SOURCE_LEGEND.map(({ source, label, icon: Icon, tone }) => (
              <div
                key={source}
                style={
                  {
                    "--source-tone": tone,
                  } as React.CSSProperties &
                    Record<"--source-tone", string>
                }
                className="relative min-w-0 overflow-hidden rounded-2xl border border-[color-mix(in_oklch,var(--source-tone)_24%,var(--color-border))] bg-[color-mix(in_oklch,var(--source-tone)_6%,var(--color-card))] p-4 shadow-sm"
              >
                <Icon
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-5 -top-4 size-20 rotate-6 text-[color-mix(in_oklch,var(--source-tone)_10%,transparent)]"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklch,var(--source-tone)_20%,var(--color-border))] bg-[color-mix(in_oklch,var(--source-tone)_14%,var(--color-card))] text-[color-mix(in_oklch,var(--source-tone)_70%,var(--color-foreground))]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-2xl font-semibold leading-none tabular-nums text-[var(--color-foreground)]">
                    {counts[source]}
                  </p>
                </div>
                <p className="relative mt-3 truncate text-sm font-semibold leading-none text-[var(--color-muted-foreground)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_36%,var(--color-card))]">
          <CardTitle>Room timeline</CardTitle>
          <CardDescription>
            One room at a time — switch between day, week, and month views for the
            selected room.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {query.isError ? (
            <div className="p-5">
              <ProblemAlert error={query.error} />
            </div>
          ) : query.isPending || roomId === "" ? (
            <div className="p-5">
              <Skeleton className="h-[32rem] w-full rounded-xl" />
            </div>
          ) : (
            <CalendarView blocks={blocks} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
