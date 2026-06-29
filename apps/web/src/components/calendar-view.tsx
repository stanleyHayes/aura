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

/**
 * Day/week/month calendar of the unified block feed (§7.7) via Schedule-X
 * (ADR-0005). Lectures, bookings, maintenance and computed available gaps are
 * colour-coded by source. Blocks carry the institution-local date + HH:MM
 * window, which Schedule-X consumes directly as "YYYY-MM-DD HH:MM".
 */

const SOURCE_CALENDAR: Record<CalendarBlock["source"], string> = {
  LECTURE: "lecture",
  BOOKING: "booking",
  MAINTENANCE: "maintenance",
  AVAILABLE: "available",
};

// The engine emits an exclusive end of "24:00" for full-day blocks; Schedule-X
// only accepts 00:00–23:59, so clamp it to the end of the day.
function clampEnd(time: string): string {
  return time === "24:00" ? "23:59" : time;
}

export function CalendarView({ blocks }: { blocks: CalendarBlock[] }) {
  const events = React.useMemo(
    () =>
      blocks.map((b, i) => ({
        id: `${b.source}-${b.room_id}-${b.date}-${b.start}-${i}`,
        title:
          b.source === "BOOKING" && b.status
            ? `${b.label} (${b.status.toLowerCase()})`
            : b.label,
        start: `${b.date} ${b.start}`,
        end: `${b.date} ${clampEnd(b.end)}`,
        calendarId: SOURCE_CALENDAR[b.source],
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
