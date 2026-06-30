"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";
import { cn } from "@cbs/ui/lib/cn";

/**
 * On-brand replacement for `<input type="date">`. The wire format is a plain
 * `"YYYY-MM-DD"` calendar date (no timezone). To avoid the classic off-by-one
 * drift, the string is parsed/formatted by hand against local midnight — never
 * via `new Date("YYYY-MM-DD")`, which is interpreted as UTC.
 */
export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable date, also `"YYYY-MM-DD"`. Earlier days are disabled. */
  min?: string;
  disabled?: boolean;
  className?: string;
  align?: "start" | "end" | "center";
};

/** Parse a `"YYYY-MM-DD"` string into a local-midnight Date, or null. */
function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Reject impossible dates (e.g. 2026-02-31 rolling over).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Format a Date as a `"YYYY-MM-DD"` key using its local components. */
function toDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  min,
  disabled = false,
  className,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => parseDateKey(value), [value]);
  const minDate = React.useMemo(
    () => (min ? parseDateKey(min) : null),
    [min],
  );
  const today = React.useMemo(() => startOfDay(new Date()), []);

  // The month currently shown in the grid (independent of the committed value).
  const [viewMonth, setViewMonth] = React.useState<Date>(
    () => startOfMonth(selected ?? today),
  );
  // Roving-focus target for keyboard navigation within the grid.
  const [focusDate, setFocusDate] = React.useState<Date>(
    () => selected ?? today,
  );

  const gridRef = React.useRef<HTMLDivElement>(null);
  const shouldFocusRef = React.useRef(false);

  // When the popover opens, re-centre on the selected day (or today).
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const anchor = selected ?? today;
      setViewMonth(startOfMonth(anchor));
      setFocusDate(anchor);
    }
  }

  // Build the 6-week grid (Monday-first) for the visible month.
  const weeks = React.useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(viewMonth), {
      weekStartsOn: 1,
    });
    const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    // Always render six rows so the popover height never jumps month-to-month.
    while (days.length < 42) {
      days.push(addDays(days[days.length - 1]!, 1));
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [viewMonth]);

  function isDisabledDay(day: Date): boolean {
    return minDate ? startOfDay(day) < startOfDay(minDate) : false;
  }

  function commit(day: Date) {
    if (isDisabledDay(day)) return;
    onChange(toDateKey(day));
    setOpen(false);
  }

  function moveFocus(next: Date) {
    setFocusDate(next);
    if (!isSameMonth(next, viewMonth)) {
      setViewMonth(startOfMonth(next));
    }
    shouldFocusRef.current = true;
  }

  // After a keyboard move, pull DOM focus onto the newly active day button.
  React.useEffect(() => {
    if (!open || !shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    const node = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-day="${toDateKey(focusDate)}"]`,
    );
    node?.focus();
  }, [focusDate, open, weeks]);

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(addDays(focusDate, -1));
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(addDays(focusDate, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(addDays(focusDate, -7));
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(addDays(focusDate, 7));
        break;
      case "Home":
        event.preventDefault();
        moveFocus(startOfWeek(focusDate, { weekStartsOn: 1 }));
        break;
      case "End":
        event.preventDefault();
        moveFocus(endOfWeek(focusDate, { weekStartsOn: 1 }));
        break;
      case "PageUp":
        event.preventDefault();
        moveFocus(addMonths(focusDate, -1));
        break;
      case "PageDown":
        event.preventDefault();
        moveFocus(addMonths(focusDate, 1));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(focusDate);
        break;
      default:
        break;
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-left text-sm shadow-sm transition-colors",
            "hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              selected
                ? "text-[var(--color-foreground)]"
                : "text-[var(--color-muted-foreground)]",
            )}
          >
            {selected ? format(selected, "EEE, dd MMM yyyy") : placeholder}
          </span>
          <Calendar
            className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto min-w-[18rem] p-3">
        {/* Header: month + year with prev/next navigation. */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            className="grid size-8 place-items-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className="text-sm font-semibold text-[var(--color-foreground)]">
            {format(viewMonth, "MMMM yyyy")}
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="grid size-8 place-items-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Weekday header row (Monday-first). */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              aria-hidden="true"
              className="grid h-8 place-items-center text-xs font-medium text-[var(--color-muted-foreground)]"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid. */}
        <div
          ref={gridRef}
          role="grid"
          aria-label="Choose a date"
          onKeyDown={handleGridKeyDown}
          className="mt-1 grid grid-cols-7 gap-1"
        >
          {weeks.flat().map((day) => {
            const outside = !isSameMonth(day, viewMonth);
            const isSelected = selected ? isSameDay(day, selected) : false;
            const isToday = isSameDay(day, today);
            const isFocusTarget = isSameDay(day, focusDate);
            const dayDisabled = isDisabledDay(day);
            return (
              <button
                key={toDateKey(day)}
                type="button"
                data-day={toDateKey(day)}
                role="gridcell"
                aria-label={format(day, "EEEE, d MMMM yyyy")}
                aria-selected={isSelected}
                aria-current={isToday ? "date" : undefined}
                disabled={dayDisabled}
                tabIndex={isFocusTarget ? 0 : -1}
                onClick={() => commit(day)}
                className={cn(
                  "grid size-9 place-items-center rounded-md text-sm tabular-nums transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                  isSelected
                    ? "bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]"
                    : "text-[var(--color-foreground)] hover:bg-[var(--color-accent)]",
                  outside && !isSelected
                    ? "text-[var(--color-muted-foreground)] opacity-60"
                    : null,
                  isToday && !isSelected
                    ? "ring-1 ring-inset ring-[var(--color-maroon)]"
                    : null,
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {/* Footer: clear (left) / today (right). */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isDisabledDay(today)}
            onClick={() => commit(today)}
            className="rounded-md px-2 py-1 text-xs font-medium text-[var(--color-maroon)] transition-colors hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
