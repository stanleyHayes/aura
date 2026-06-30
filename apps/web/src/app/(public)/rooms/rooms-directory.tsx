"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, DoorOpen, ImageIcon, Search, Users } from "lucide-react";
import { ROOM_TYPE_LABELS, type Room } from "@cbs/schemas";
import { Card, CardContent } from "@cbs/ui/components/card";
import { Badge } from "@cbs/ui/components/badge";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { Combobox } from "@/components/combobox";
import { Reveal3D } from "@/components/reveal-3d";
import { EmptyState } from "@/components/empty-state";
import { IconWatermark } from "@/components/watermark";

const PAGE_SIZE = 9;
const ALL = "ALL";

/**
 * Client-side directory: search + room-type + building filters and pagination
 * over the (≤200) public room list the server already fetched. Filtering is
 * instant (no round-trips); the grid re-reveals on page/filter change.
 */
export function RoomsDirectory({ rooms }: Readonly<{ rooms: Room[] }>) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<string>(ALL);
  const [building, setBuilding] = React.useState<string>(ALL);
  const [page, setPage] = React.useState(1);

  const types = React.useMemo(
    () => Array.from(new Set(rooms.map((r) => r.room_type))),
    [rooms],
  );
  const buildings = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) if (r.building_name) set.add(r.building_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((r) => {
      if (type !== ALL && r.room_type !== type) return false;
      if (building !== ALL && r.building_name !== building) return false;
      if (needle) {
        const hay = `${r.name} ${r.room_code} ${r.building_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rooms, query, type, building]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const hasFilters = query.trim() !== "" || type !== ALL || building !== ALL;

  function resetPage<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function clearAll() {
    setQuery("");
    setType(ALL);
    setBuilding(ALL);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search by name, code or building"
            aria-label="Search rooms"
            className="h-11 bg-[var(--color-card)] pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
          <Select value={type} onValueChange={resetPage(setType)}>
            <SelectTrigger
              aria-label="Filter by room type"
              className="h-11 w-full bg-[var(--color-card)] sm:w-44"
            >
              <SelectValue placeholder="Room type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {ROOM_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Combobox
            value={building}
            onValueChange={resetPage(setBuilding)}
            placeholder="Building"
            searchPlaceholder="Search buildings…"
            emptyText="No buildings found."
            triggerClassName="h-11 w-full bg-[var(--color-card)] sm:w-44"
            options={[
              { value: ALL, label: "All buildings" },
              ...buildings.map((b) => ({ value: b, label: b })),
            ]}
          />
        </div>
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {filtered.length === 0
            ? "No rooms"
            : `${filtered.length} room${filtered.length === 1 ? "" : "s"}`}
          {hasFilters ? " match your filters" : ""}
        </p>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No rooms match"
          description="Try a different search term, room type, or building."
        />
      ) : (
        <>
          <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((room, i) => (
              <Reveal3D as="li" key={room.id} delay={Math.min(i, 8) * 60}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                >
                  <Card className="relative overflow-hidden transition-shadow group-hover:shadow-md">
                    {room.image_url ? (
                      <div className="relative h-36 overflow-hidden border-b border-[var(--color-border)]">
                        <img
                          src={room.image_url}
                          alt={`${room.name} room`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    ) : (
                      <>
                        <IconWatermark
                          icon={DoorOpen}
                          className="-right-6 top-5 size-24 rotate-6"
                        />
                        <div className="grid h-24 place-items-center border-b border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                          <ImageIcon className="size-8" aria-hidden="true" />
                        </div>
                      </>
                    )}
                    <CardContent className="relative flex flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-serif text-lg tracking-tight">
                            {room.name}
                          </h2>
                          <p className="text-sm text-[var(--color-muted-foreground)]">
                            {room.room_code}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {ROOM_TYPE_LABELS[room.room_type]}
                        </Badge>
                      </div>
                      <dl className="flex flex-col gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                        {room.building_name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4" aria-hidden="true" />
                            <dt className="sr-only">Building</dt>
                            <dd>{room.building_name}</dd>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Users className="size-4" aria-hidden="true" />
                          <dt className="sr-only">Capacity</dt>
                          <dd>Seats {room.capacity}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </Link>
              </Reveal3D>
            ))}
          </ul>

          {pageCount > 1 ? (
            <nav
              aria-label="Room directory pagination"
              className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row"
            >
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}{" "}
                of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </Button>
                <span className="px-1 text-sm font-medium tabular-nums">
                  Page {current} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current >= pageCount}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
