/**
 * Institution-timezone date/time helpers (§8.1, §10.1).
 *
 * The API stores and returns timestamps as RFC 3339 UTC. Every human-facing
 * render MUST happen in the institution timezone (default `Africa/Accra`),
 * NEVER the browser's implicit local zone. These helpers wrap `Intl` so all
 * formatting flows through one configurable place.
 *
 * `date-fns` is used for *calendar maths* (interval arithmetic, weekday
 * derivation) where a zone is not required; anything user-visible uses the
 * `Intl`-based formatters here with an explicit `timeZone`.
 */

export const DEFAULT_INSTITUTION_TZ = "Africa/Accra";

/** Read the configured institution TZ (build-time public env, falls back). */
export function institutionTz(): string {
  // NEXT_PUBLIC_APP_TZ is inlined at build; safe to read on client + server.
  // Accessed via globalThis so this module needs no Node type dependency.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const fromEnv = proc?.env?.NEXT_PUBLIC_APP_TZ;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_INSTITUTION_TZ;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Shown when a value isn't a valid date (null / "" / zero-value / malformed).
 *  Without this guard, Intl.DateTimeFormat.format() throws "Invalid time value"
 *  and crashes the whole rendering tree. */
const INVALID_DATE_LABEL = "—";

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

type FormatOpts = { tz?: string };

/** e.g. "Mon, 28 Jun 2026" */
export function formatDate(
  value: Date | string | number,
  opts: FormatOpts = {},
): string {
  const d = toDate(value);
  if (!isValidDate(d)) return INVALID_DATE_LABEL;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: opts.tz ?? institutionTz(),
  }).format(d);
}

/** e.g. "14:30" (24-hour, institution tz). */
export function formatTime(
  value: Date | string | number,
  opts: FormatOpts = {},
): string {
  const d = toDate(value);
  if (!isValidDate(d)) return INVALID_DATE_LABEL;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: opts.tz ?? institutionTz(),
  }).format(d);
}

/** e.g. "Mon, 28 Jun 2026, 14:30" */
export function formatDateTime(
  value: Date | string | number,
  opts: FormatOpts = {},
): string {
  const d = toDate(value);
  if (!isValidDate(d)) return INVALID_DATE_LABEL;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: opts.tz ?? institutionTz(),
  }).format(d);
}

/** e.g. "14:30 – 16:00" given two RFC 3339 instants on the same local day. */
export function formatTimeRange(
  start: Date | string | number,
  end: Date | string | number,
  opts: FormatOpts = {},
): string {
  return `${formatTime(start, opts)} – ${formatTime(end, opts)}`;
}

/** The institution-local calendar date as `YYYY-MM-DD` (for date inputs / API). */
export function toInstitutionDateKey(
  value: Date | string | number,
  opts: FormatOpts = {},
): string {
  const d = toDate(value);
  if (!isValidDate(d)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: opts.tz ?? institutionTz(),
  }).format(d);
  return parts; // en-CA yields YYYY-MM-DD
}

/** Relative-ish label for notifications/timelines, e.g. "2 hours ago". */
export function formatRelative(value: Date | string | number): string {
  const date = toDate(value);
  if (!isValidDate(date)) return INVALID_DATE_LABEL;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 7 * day) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(date);
}
