"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@cbs/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";
import { cn } from "@cbs/ui/lib/cn";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary line shown under the label (e.g. a code or status). */
  description?: string;
  /** Extra text included in the search match but not displayed. */
  keywords?: string;
};

/**
 * Searchable dropdown (autocomplete) — a drop-in replacement for a `Select`
 * whose options come from the backend and can grow long. Type to filter;
 * arrow keys + Enter to choose; Escape to close. Keeps the same `value` /
 * `onValueChange` contract as the shadcn Select so call sites swap cleanly.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyText = "No matches found.",
  id,
  disabled = false,
  align = "start",
  triggerClassName,
}: {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  align?: "start" | "end";
  triggerClassName?: string;
}) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) =>
      `${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [options, search]);

  function choose(option: ComboboxOption) {
    onValueChange(option.value);
    setOpen(false);
    setSearch("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setActiveIndex(0);
    if (!next) setSearch("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled || options.length === 0}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-left text-sm shadow-sm transition-colors hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName,
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
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown
            className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
      >
        <div className="border-b border-[var(--color-border)] p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              className="h-10 bg-[var(--color-card)] pl-9"
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
        <div
          id={listId}
          role="listbox"
          className="max-h-72 overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              {emptyText}
            </p>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                      : "text-[var(--color-popover-foreground)]",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-[var(--color-maroon)]",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
