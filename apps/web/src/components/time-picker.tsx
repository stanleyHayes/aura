"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";
import { cn } from "@cbs/ui/lib/cn";

/**
 * On-brand replacement for `<input type="time">`. The wire format is a plain
 * 24-hour `"HH:MM"` string; the trigger and list show a friendly 12-hour label.
 * No timezone is involved — these are wall-clock times.
 */
export type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Minute increment between offered options. */
  step?: number;
  align?: "start" | "end" | "center";
};

/** Validate / normalise a `"HH:MM"` string into minutes-from-midnight, or null. */
function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes-from-midnight → 24-hour `"HH:MM"`. */
function toTimeKey(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes-from-midnight → friendly 12-hour label, e.g. "11:00 AM". */
function formatLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const DAY_MINUTES = 24 * 60;

export function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
  step = 30,
  align = "start",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const safeStep = step > 0 ? step : 30;
  const selectedMinutes = React.useMemo(() => parseTime(value), [value]);

  // Build the option list from 00:00 to 23:45 (or last slot < 24h) at `step`.
  const options = React.useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < DAY_MINUTES; m += safeStep) out.push(m);
    return out;
  }, [safeStep]);

  // Index of the option to scroll into view on open: the selected one, else
  // the option nearest the current wall-clock time.
  const scrollTargetIndex = React.useMemo(() => {
    const target =
      selectedMinutes ??
      (() => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
      })();
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < options.length; i++) {
      const delta = Math.abs(options[i]! - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best;
  }, [options, selectedMinutes]);

  function commit(minutes: number) {
    onChange(toTimeKey(minutes));
    setOpen(false);
  }

  // On open, centre the relevant row in the scroll viewport.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const node = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-index="${scrollTargetIndex}"]`,
      );
      node?.scrollIntoView({ block: "center" });
      node?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, scrollTargetIndex]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
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
              selectedMinutes !== null
                ? "text-[var(--color-foreground)]"
                : "text-[var(--color-muted-foreground)]",
            )}
          >
            {selectedMinutes !== null
              ? formatLabel(selectedMinutes)
              : placeholder}
          </span>
          <Clock
            className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[var(--radix-popover-trigger-width)] min-w-[10rem] p-1"
      >
        <div
          ref={listRef}
          role="listbox"
          aria-label="Choose a time"
          className="max-h-64 overflow-y-auto"
        >
          {options.map((minutes, index) => {
            const isSelected = minutes === selectedMinutes;
            return (
              <button
                key={minutes}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={index}
                onClick={() => commit(minutes)}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm tabular-nums transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                  isSelected
                    ? "bg-[var(--color-primary)] font-medium text-[var(--color-primary-foreground)]"
                    : "text-[var(--color-foreground)] hover:bg-[var(--color-accent)]",
                )}
              >
                {formatLabel(minutes)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
