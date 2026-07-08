"use client";

import * as React from "react";
import type { AvailabilityResult, FreeInterval } from "@cbs/schemas";
import { ROOM_TYPE_LABELS } from "@cbs/schemas";
import { cn } from "@cbs/ui/lib/cn";
import { Button } from "@cbs/ui/components/button";
import {
  bandPosition,
  DEFAULT_WINDOW,
  hhmm,
  hourTicks,
  minutesOfDay,
  type DisplayWindow,
} from "@/lib/intervals";

/**
 * Custom availability grid (ADR-0005): rooms down the y-axis, time across the
 * x-axis. Only free (available) intervals are shown as clickable dashed bands.
 * Occupied blocks (lectures, bookings, maintenance) are hidden because the
 * requester only needs to see what can be booked. Keyboard-operable (§12.2).
 */
export function AvailabilityGrid({
  results,
  requestedStart,
  requestedEnd,
  window = DEFAULT_WINDOW,
  onPick,
}: {
  results: AvailabilityResult[];
  requestedStart: string;
  requestedEnd: string;
  window?: DisplayWindow;
  onPick: (roomId: string, interval: FreeInterval) => void;
}) {
  const ticks = hourTicks(window);
  const reqStart = minutesOfDay(requestedStart);
  const reqEnd = minutesOfDay(requestedEnd);
  const reqPos = bandPosition(reqStart, reqEnd, window);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Time axis */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
        <div className="w-48 shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Room
        </div>
        <div className="relative flex-1">
          <div className="flex h-8 items-center">
            {ticks.map((m) => {
              const pos = bandPosition(m, m, window);
              return (
                <span
                  key={m}
                  className="absolute -translate-x-1/2 text-[10px] tabular-nums text-[var(--color-muted-foreground)]"
                  style={{ left: `${pos.left}%` }}
                >
                  {hhmm(m)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {results.map(({ room, free_intervals }) => (
          <li key={room.id} className="flex items-stretch">
            <div className="flex w-48 shrink-0 flex-col justify-center px-4 py-3">
              <p className="truncate text-sm font-medium">{room.name}</p>
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {room.room_code} · {ROOM_TYPE_LABELS[room.room_type]} · seats{" "}
                {room.capacity}
              </p>
            </div>
            <div className="relative h-16 flex-1 border-l border-[var(--color-border)]">
              {/* Neutral base */}
              <div className="absolute inset-0 bg-[var(--color-muted)]/20" />
              {/* Hour gridlines */}
              {ticks.map((m) => {
                const pos = bandPosition(m, m, window);
                return (
                  <span
                    key={m}
                    aria-hidden="true"
                    className="absolute inset-y-0 w-px bg-[var(--color-border)]/60"
                    style={{ left: `${pos.left}%` }}
                  />
                );
              })}
              {/* Requested-window marker */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 border-x-2 border-dashed border-[var(--color-ink-400)] bg-[color-mix(in_oklch,var(--color-ink-300)_8%,transparent)]"
                style={{ left: `${reqPos.left}%`, width: `${reqPos.width}%` }}
              />
              {/* Free gaps — click to book */}
              {(free_intervals ?? []).map((iv) => {
                const pos = bandPosition(iv.start, iv.end, window);
                if (pos.width <= 0) return null;
                return (
                  <Button
                    key={`free-${iv.start}-${iv.end}`}
                    type="button"
                    onClick={() => onPick(room.id, iv)}
                    className={cn(
                      "absolute top-1/2 h-9 -translate-y-1/2 justify-center rounded border border-dashed border-[color-mix(in_oklch,var(--color-approved)_55%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-approved)_12%,transparent)] px-1.5 text-[11px] font-medium text-[color-mix(in_oklch,var(--color-approved)_78%,var(--color-foreground))] hover:bg-[color-mix(in_oklch,var(--color-approved)_26%,transparent)]",
                    )}
                    style={{ left: `${pos.left}%`, width: `calc(${pos.width}% - 2px)` }}
                    aria-label={`Book ${room.name} from ${hhmm(iv.start)} to ${hhmm(iv.end)}`}
                  >
                    <span className="truncate">
                      {pos.width > 7 ? `${hhmm(iv.start)}–${hhmm(iv.end)}` : "＋"}
                    </span>
                  </Button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AvailabilityLegend() {
  const items = [
    { label: "Free (click to book)", cls: "border border-dashed border-[color-mix(in_oklch,var(--color-approved)_55%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-approved)_16%,transparent)]" },
    { label: "Requested window", cls: "border-x-2 border-dashed border-[var(--color-ink-400)] bg-[color-mix(in_oklch,var(--color-ink-300)_8%,transparent)]" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className={cn("inline-block h-3 w-6 rounded-sm", it.cls)} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
