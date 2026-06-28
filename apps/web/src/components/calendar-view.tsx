"use client";

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

/**
 * Day/week/month calendar of the unified block feed (§7.7) via Schedule-X
 * (ADR-0005). Lectures, bookings, maintenance and computed available gaps are
 * colour-coded by source. Times are pinned to the institution TZ.
 */

const SOURCE_CALENDAR: Record<CalendarBlock["source"], string> = {
  LECTURE: "lecture",
  BOOKING: "booking",
  MAINTENANCE: "maintenance",
  AVAILABLE: "available",
};

// Schedule-X expects local datetime strings "YYYY-MM-DD HH:MM".
function toSxDateTime(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: env.appTz,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function CalendarView({ blocks }: { blocks: CalendarBlock[] }) {
  const events = React.useMemo(
    () =>
      blocks.map((b, i) => ({
        id: b.reference_id ?? `${b.source}-${i}`,
        title:
          b.source === "BOOKING" && b.booking_status
            ? `${b.title} (${b.booking_status.toLowerCase()})`
            : b.title,
        start: toSxDateTime(b.starts_at),
        end: toSxDateTime(b.ends_at),
        calendarId: SOURCE_CALENDAR[b.source],
        description: b.room_code,
      })),
    [blocks],
  );

  const calendar: CalendarApp | null = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    defaultView: createViewWeek().name,
    events,
    calendars: {
      lecture: {
        colorName: "lecture",
        lightColors: { main: "#4f46e5", container: "#e0e7ff", onContainer: "#312e81" },
        darkColors: { main: "#a5b4fc", container: "#312e81", onContainer: "#e0e7ff" },
      },
      booking: {
        colorName: "booking",
        lightColors: { main: "#0f9d77", container: "#d1fae5", onContainer: "#064e3b" },
        darkColors: { main: "#6ee7b7", container: "#064e3b", onContainer: "#d1fae5" },
      },
      maintenance: {
        colorName: "maintenance",
        lightColors: { main: "#b45309", container: "#fef3c7", onContainer: "#78350f" },
        darkColors: { main: "#fbbf24", container: "#78350f", onContainer: "#fef3c7" },
      },
      available: {
        colorName: "available",
        lightColors: { main: "#15803d", container: "#dcfce7", onContainer: "#14532d" },
        darkColors: { main: "#86efac", container: "#14532d", onContainer: "#dcfce7" },
      },
    },
  });

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
