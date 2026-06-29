"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CalendarSearch, DoorClosed, SlidersHorizontal } from "lucide-react";
import {
  AvailabilitySearchForm as Schema,
  type AvailabilitySearchForm as Values,
  type AvailabilityResult,
  type FreeInterval,
  ROOM_TYPE_LABELS,
  RoomType,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Checkbox } from "@cbs/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useBuildings, useEquipment } from "@/lib/hooks/reference";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProblemAlert } from "@/components/problem-alert";
import { Field } from "@/components/forms/field";
import {
  AvailabilityGrid,
  AvailabilityLegend,
} from "@/components/availability-grid";
import { BookDialog, type BookDraft } from "@/components/book-dialog";
import { hhmm } from "@/lib/intervals";

const roomTypes = RoomType.options;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SearchClient() {
  const buildings = useBuildings();
  const equipment = useEquipment();
  const [submitted, setSubmitted] = React.useState<Values | null>(null);
  const [draft, setDraft] = React.useState<BookDraft | null>(null);
  const [bookOpen, setBookOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      date: todayKey(),
      start: "09:00",
      end: "11:00",
      building_id: "",
      room_type: "",
      equipment: [],
    },
  });

  const query = useQuery({
    queryKey: qk.availability(submitted ?? {}),
    enabled: submitted !== null,
    queryFn: async (): Promise<AvailabilityResult[]> => {
      const v = submitted!;
      const res = unwrap(
        await api.GET("/api/v1/availability/search", {
          params: {
            query: {
              date: v.date,
              start: v.start,
              end: v.end,
              building_id: v.building_id || undefined,
              min_capacity: v.min_capacity || undefined,
              room_type: v.room_type || undefined,
              equipment: v.equipment?.length ? v.equipment.join(",") : undefined,
              limit: 100,
            },
          },
        }),
      );
      return (res.data ?? []) as AvailabilityResult[];
    },
  });

  const onSubmit = form.handleSubmit((values) => setSubmitted(values));

  function pickInterval(roomId: string, interval: FreeInterval) {
    const result = query.data?.find((r) => r.room.id === roomId);
    if (!result || !submitted) return;
    setDraft({
      room: result.room,
      date: submitted.date,
      // Engine intervals are minutes-from-midnight; the dialog wants HH:MM.
      start: hhmm(interval.start),
      end: hhmm(interval.end),
    });
    setBookOpen(true);
  }

  const results = query.data ?? [];
  const selectedEquipment = form.watch("equipment") ?? [];

  return (
    <>
      <PageHeader
        title="Find a room"
        description="Search availability derived from the live timetable, approved bookings and maintenance. All times are West Africa Time (Africa/Accra)."
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Filters */}
        <Card className="h-fit">
          <CardContent className="p-5">
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
              </div>

              <Field id="date" label="Date" error={form.formState.errors.date?.message}>
                {(p) => <Input {...p} type="date" {...form.register("date")} />}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field id="start" label="From" error={form.formState.errors.start?.message}>
                  {(p) => <Input {...p} type="time" {...form.register("start")} />}
                </Field>
                <Field id="end" label="To" error={form.formState.errors.end?.message}>
                  {(p) => <Input {...p} type="time" {...form.register("end")} />}
                </Field>
              </div>

              <Field id="building_id" label="Building">
                {(p) => (
                  <Select
                    onValueChange={(v) =>
                      form.setValue("building_id", v === "any" ? "" : v)
                    }
                    value={form.watch("building_id") || "any"}
                  >
                    <SelectTrigger id={p.id}>
                      <SelectValue placeholder="Any building" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any building</SelectItem>
                      {(buildings.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field id="room_type" label="Room type">
                {(p) => (
                  <Select
                    onValueChange={(v) =>
                      form.setValue("room_type", v === "any" ? "" : (v as RoomType))
                    }
                    value={form.watch("room_type") || "any"}
                  >
                    <SelectTrigger id={p.id}>
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any type</SelectItem>
                      {roomTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ROOM_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                id="min_capacity"
                label="Minimum capacity"
                error={form.formState.errors.min_capacity?.message}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={1}
                    placeholder="Any"
                    {...form.register("min_capacity", { valueAsNumber: true })}
                  />
                )}
              </Field>

              {(equipment.data ?? []).length > 0 ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Required equipment</legend>
                  {(equipment.data ?? []).map((e) => {
                    const checked = selectedEquipment.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const next = c
                              ? [...selectedEquipment, e.id]
                              : selectedEquipment.filter((id) => id !== e.id);
                            form.setValue("equipment", next);
                          }}
                        />
                        {e.name}
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}

              <Button type="submit" className="mt-2">
                <CalendarSearch className="size-4" /> Search availability
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex flex-col gap-4">
          {submitted === null ? (
            <EmptyState
              icon={CalendarSearch}
              title="Search to see free rooms"
              description="Choose a date and time window, then refine with building, capacity, type and equipment."
            />
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <ProblemAlert error={query.error} />
          ) : results.length === 0 ? (
            <EmptyState
              icon={DoorClosed}
              title="No rooms free for that window"
              description="Try widening the time window, lowering the minimum capacity, or relaxing the equipment requirements."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {results.length} room{results.length === 1 ? "" : "s"} free for
                  the entire window
                </p>
                <AvailabilityLegend />
              </div>
              <AvailabilityGrid
                results={results}
                requestedStart={submitted.start}
                requestedEnd={submitted.end}
                onPick={pickInterval}
              />
            </>
          )}
        </div>
      </div>

      <BookDialog draft={draft} open={bookOpen} onOpenChange={setBookOpen} />
    </>
  );
}
