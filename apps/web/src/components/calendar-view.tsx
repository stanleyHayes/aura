"use client";

// Schedule-X v4 requires a global `Temporal`. Native browser Temporal is an
// evolving draft (and absent in some engines / SSR), so install the polyfill
// global: it overwrites globalThis.Temporal with one known implementation that
// BOTH Schedule-X and our event construction use, so the library's
// `instanceof Temporal.ZonedDateTime` checks pass. This is the peer dependency
// Schedule-X expects the app to provide; the app previously did not, which is
// why the calendar broke. Must be imported before Schedule-X is used.
import "temporal-polyfill/global";

import * as React from "react";
import {
  createViewDay,
  createViewMonthGrid,
  createViewWeek,
  type CalendarApp,
} from "@schedule-x/calendar";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import "@schedule-x/theme-default/dist/index.css";
import type { CalendarBlock } from "@cbs/schemas";
import { env } from "@/lib/env";
import { scheduleXEventId } from "@/lib/calendar-events";
import { Button } from "@cbs/ui/components/button";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Day/week/month calendar of the unified block feed (§7.7) via Schedule-X
 * (ADR-0005). Lectures, bookings, maintenance and computed available gaps are
 * colour-coded by source. Blocks carry the institution-local date + HH:MM
 * window.
 *
 * Schedule-X v4 requires event start/end to be `Temporal.ZonedDateTime`
 * instances (it rejects the old "YYYY-MM-DD HH:MM" strings). We build them from
 * the global `Temporal` the library itself reads. Using any other Temporal
 * instance (e.g. a separate polyfill copy) would fail Schedule-X's
 * `instanceof Temporal.ZonedDateTime` check. `Temporal` is a runtime global
 * (native in modern browsers); we guard for SSR / engines without it so the page
 * still renders; the calendar is client-only and re-populates after mount.
 */

const SOURCE_CALENDAR: Record<CalendarBlock["source"], string> = {
  LECTURE: "lecture",
  BOOKING: "booking",
  MAINTENANCE: "maintenance",
  AVAILABLE: "available",
};

type DisplayCalendarBlock = CalendarBlock & {
  displaySegment?: "hour";
};

// The engine emits an exclusive end of "24:00" for full-day blocks; Schedule-X
// only accepts 00:00-23:59, so clamp it to the end of the day.
function clampEnd(time: string): string {
  return time === "24:00" ? "23:59" : time;
}

function timeToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  if (hours === 24 && minutes !== 0) return null;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

function splitAvailableBlockForDisplay(
  block: CalendarBlock,
): DisplayCalendarBlock[] {
  if (block.source !== "AVAILABLE") return [block];

  const start = timeToMinutes(block.start);
  const end = timeToMinutes(clampEnd(block.end));
  if (start === null || end === null || end <= start || end - start <= 60) {
    return [block];
  }

  const segments: DisplayCalendarBlock[] = [];
  for (let cursor = start; cursor < end; ) {
    const nextHourBoundary = Math.ceil((cursor + 1) / 60) * 60;
    const next = Math.min(end, nextHourBoundary);
    segments.push({
      ...block,
      start: minutesToTime(cursor),
      end: minutesToTime(next),
      displaySegment: "hour",
    });
    cursor = next;
  }

  return segments;
}

// Build a Temporal.ZonedDateTime from an institution-local date + HH:MM. The
// global `Temporal` is guaranteed by the temporal-polyfill/global import above.
// Returns null on an unparseable date/time so one bad block can't crash the
// whole calendar.
function toZonedDateTime(date: string, time: string): Temporal.ZonedDateTime | null {
  try {
    // Accept "HH:MM" or "HH:MM:SS"; Temporal needs a full ISO datetime string.
    const hms = time.length <= 5 ? `${time}:00` : time;
    return Temporal.PlainDateTime.from(`${date}T${hms}`).toZonedDateTime(
      env.appTz,
    );
  } catch {
    return null;
  }
}

function getDarkSnapshot() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => {};

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

// Operating hours the timetable opens on by default (staff are used to an
// 8am–6:15pm grid). The rest of the day stays collapsed until a user expands it.
const OPERATING_HOURS = { start: "08:00", end: "18:15" } as const;
const EXPANDED_HOURS = { start: "06:00", end: "22:00" } as const;
// Grid height (px) for the visible window. Fewer visible hours + a tall grid =
// the bigger, roomier rows staff expect. Tuned so an hour is ~85px.
const OPERATING_GRID_HEIGHT = 880;
const EXPANDED_GRID_HEIGHT = 1120;

export function CalendarView({ blocks }: { blocks: CalendarBlock[] }) {
  // Schedule-X has no runtime setter for dayBoundaries/gridHeight, so toggling
  // the window remounts the inner calendar (via `key`) with a fresh config.
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,var(--color-card))] px-4 py-2.5">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {expanded
            ? "Showing 06:00–22:00"
            : "Showing operating hours 08:00–18:15"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <Minimize2 className="size-4" aria-hidden="true" />
              Operating hours
            </>
          ) : (
            <>
              <Maximize2 className="size-4" aria-hidden="true" />
              Expand hours
            </>
          )}
        </Button>
      </div>
      <CalendarInner
        key={expanded ? "expanded" : "operating"}
        blocks={blocks}
        expanded={expanded}
      />
    </div>
  );
}

function CalendarInner({
  blocks,
  expanded,
}: {
  blocks: CalendarBlock[];
  expanded: boolean;
}) {
  const isDark = React.useSyncExternalStore(
    subscribeToThemeChanges,
    getDarkSnapshot,
    () => false,
  );
  const events = React.useMemo(
    () =>
      blocks
        .flatMap(splitAvailableBlockForDisplay)
        .map((b, i) => {
          const start = toZonedDateTime(b.date, b.start);
          const end = toZonedDateTime(b.date, clampEnd(b.end));
          if (!start || !end) return null;
          return {
            id: scheduleXEventId(b, i),
            title:
              b.source === "BOOKING" && b.status
                ? `${b.label} (${b.status.toLowerCase()})`
                : b.label,
            start,
            end,
            calendarId: SOURCE_CALENDAR[b.source],
            _options: {
              disableDND: true,
              disableResize: true,
              additionalClasses: [
                "aura-cal-event",
                `aura-cal-event-${b.source.toLowerCase()}`,
                b.displaySegment === "hour" ? "aura-cal-event-hourly" : "",
              ].filter(Boolean),
            },
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    [blocks],
  );

  const calendar: CalendarApp | null = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    defaultView: createViewWeek().name,
    // Clamp the visible day to the operating window (or the expanded one); the
    // grid then only draws those hours, so each row is larger.
    dayBoundaries: expanded ? EXPANDED_HOURS : OPERATING_HOURS,
    weekOptions: {
      gridHeight: expanded ? EXPANDED_GRID_HEIGHT : OPERATING_GRID_HEIGHT,
    },
    isDark,
    locale: "en-GB",
    events,
    calendars: {
      lecture: {
        colorName: "lecture",
        lightColors: { main: "#4f46e5", container: "#eef2ff", onContainer: "#312e81" },
        darkColors: { main: "#a5b4fc", container: "#1e1b4b", onContainer: "#e0e7ff" },
      },
      booking: {
        colorName: "booking",
        lightColors: { main: "#b42318", container: "#fee4e2", onContainer: "#7a271a" },
        darkColors: { main: "#f97066", container: "#55160c", onContainer: "#ffdad6" },
      },
      maintenance: {
        colorName: "maintenance",
        lightColors: { main: "#b45309", container: "#fef3c7", onContainer: "#713f12" },
        darkColors: { main: "#facc15", container: "#713f12", onContainer: "#fef3c7" },
      },
      available: {
        colorName: "available",
        lightColors: { main: "#15803d", container: "#dcfce7", onContainer: "#14532d" },
        darkColors: { main: "#86efac", container: "#123524", onContainer: "#bbf7d0" },
      },
    },
  });

  React.useEffect(() => {
    calendar?.setTheme(isDark ? "dark" : "light");
  }, [calendar, isDark]);

  // Keep events in sync when the feed changes.
  React.useEffect(() => {
    calendar?.events.set(events);
  }, [calendar, events]);

  if (!calendar) return null;

  return (
    <div className="sx-react-calendar-wrapper">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
