"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarSearch,
  Camera,
  Check,
  DoorClosed,
  Monitor,
  Presentation,
  Projector,
  Settings2,
  SlidersHorizontal,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  AvailabilitySearchForm as Schema,
  type AvailabilitySearchForm as Values,
  type AvailabilityResult,
  type Equipment,
  type FreeInterval,
  ROOM_TYPE_LABELS,
  RoomType,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Card, CardContent } from "@cbs/ui/components/card";
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
import { Combobox } from "@/components/combobox";
import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
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

type EquipmentChoice = {
  key: string;
  label: string;
  value: string;
  count: number;
  Icon: LucideIcon;
};

function normaliseEquipmentName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function equipmentIcon(label: string): LucideIcon {
  const key = normaliseEquipmentName(label);
  if (key.includes("audio") || key.includes("speaker")) return Volume2;
  if (key.includes("camera")) return Camera;
  if (key.includes("project")) return Projector;
  if (key.includes("smart") || key.includes("board") || key.includes("screen")) {
    return Monitor;
  }
  if (key.includes("conference") || key.includes("presentation")) {
    return Presentation;
  }
  return Settings2;
}

function equipmentChoices(items: Equipment[]): EquipmentChoice[] {
  const grouped = new Map<string, EquipmentChoice>();
  for (const item of items) {
    const label = (item.name || item.code).trim();
    if (!label) continue;
    const key = normaliseEquipmentName(label);
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, {
      key,
      label,
      value: label,
      count: 1,
      Icon: equipmentIcon(label),
    });
  }
  return Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
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
  const selectedEquipment = useWatch({
    control: form.control,
    name: "equipment",
  }) ?? [];
  const selectedBuildingId = useWatch({
    control: form.control,
    name: "building_id",
  });
  const selectedRoomType = useWatch({
    control: form.control,
    name: "room_type",
  });
  const dateValue = useWatch({ control: form.control, name: "date" });
  const startValue = useWatch({ control: form.control, name: "start" });
  const endValue = useWatch({ control: form.control, name: "end" });
  const equipmentOptions = React.useMemo(
    () => equipmentChoices(equipment.data ?? []),
    [equipment.data],
  );

  function toggleEquipment(value: string) {
    const next = selectedEquipment.includes(value)
      ? selectedEquipment.filter((item) => item !== value)
      : [...selectedEquipment, value];
    form.setValue("equipment", next, { shouldDirty: true });
  }

  return (
    <>
      <PageHeader
        icon={CalendarSearch}
        title="Find a room"
        description="Search availability derived from the live timetable, approved bookings and maintenance. All times are West Africa Time (Africa/Accra)."
      />

      <div className="flex flex-col gap-6">
        {/* Filters (full-width bar on top) */}
        <Card className="h-fit">
          <CardContent className="p-5">
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              <div className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                <Field id="date" label="Date" error={form.formState.errors.date?.message}>
                  {(p) => (
                    <DatePicker
                      id={p.id}
                      value={dateValue}
                      onChange={(v) =>
                        form.setValue("date", v, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                </Field>

                <Field id="start" label="From" error={form.formState.errors.start?.message}>
                  {(p) => (
                    <TimePicker
                      id={p.id}
                      step={15}
                      value={startValue}
                      onChange={(v) =>
                        form.setValue("start", v, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                </Field>

                <Field id="end" label="To" error={form.formState.errors.end?.message}>
                  {(p) => (
                    <TimePicker
                      id={p.id}
                      step={15}
                      value={endValue}
                      onChange={(v) =>
                        form.setValue("end", v, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                </Field>

                <Field id="building_id" label="Building">
                  {(p) => (
                    <Combobox
                      id={p.id}
                      value={selectedBuildingId || ""}
                      onValueChange={(v) => form.setValue("building_id", v)}
                      placeholder="Any building"
                      searchPlaceholder="Search buildings…"
                      emptyText="No buildings found."
                      options={[
                        { value: "", label: "Any building" },
                        ...(buildings.data ?? []).map((b) => ({
                          value: b.id,
                          label: b.name,
                          description: b.code,
                        })),
                      ]}
                    />
                  )}
                </Field>

                <Field id="room_type" label="Room type">
                  {(p) => (
                    <Select
                      onValueChange={(v) =>
                        form.setValue("room_type", v === "any" ? "" : (v as RoomType))
                      }
                      value={selectedRoomType || "any"}
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
                      {...form.register("min_capacity", {
                        // Empty means "Any" — map to undefined (valueAsNumber
                        // would produce NaN, which fails the optional schema).
                        setValueAs: (v) =>
                          v === "" || v === null || v === undefined
                            ? undefined
                            : Number(v),
                      })}
                    />
                  )}
                </Field>
              </div>

              {equipmentOptions.length > 0 ? (
                <fieldset className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <legend className="text-sm font-medium">
                        Must-have equipment
                      </legend>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-muted-foreground)]">
                        Pick only the facilities the room must have.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                      {selectedEquipment.length || "No"} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {equipmentOptions.map((option) => (
                      <EquipmentChip
                        key={option.key}
                        option={option}
                        active={selectedEquipment.includes(option.value)}
                        onToggle={() => toggleEquipment(option.value)}
                      />
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" className="w-full px-6 sm:w-auto">
                  <CalendarSearch className="size-4" /> Search availability
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex flex-col gap-4">
          {submitted === null ? (
            <EmptyState
              icon={CalendarSearch}
              title="Search to see rooms and their day"
              description="Choose a date and time window, then refine by building, capacity, type and equipment. Each room shows its lectures and bookings, with free slots highlighted."
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
              title="No rooms match those filters"
              description="Try a different building, a lower minimum capacity, another room type, or fewer equipment requirements."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {results.length} matching room{results.length === 1 ? "" : "s"} ·
                  click any free (dashed) slot to book
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

function EquipmentChip({
  option,
  active,
  onToggle,
}: {
  option: EquipmentChoice;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = option.Icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      title={
        option.count > 1
          ? `${option.label} · ${option.count} catalogue variants merged`
          : option.label
      }
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
        active
          ? "border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]"
          : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[color-mix(in_oklch,var(--color-primary)_45%,var(--color-border))] hover:bg-[var(--color-accent)]",
      ].join(" ")}
    >
      <Icon
        className={[
          "size-4 shrink-0",
          active
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-muted-foreground)]",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap font-medium">{option.label}</span>
      {active ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : null}
    </button>
  );
}
