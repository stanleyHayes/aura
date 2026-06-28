/**
 * Date/time helpers. Payloads carry RFC 3339 UTC timestamps; the client renders
 * in the institution timezone (Section 8.1). For the MVP scaffold we treat the
 * device locale as the rendering target and compose institution-local wall-clock
 * times into ISO strings for submission.
 *
 * NOTE: A production build should resolve the institution timezone from config
 * (e.g. `Africa/Accra`, Section 6.7) and convert via a tz-aware library. This is
 * intentionally simple and dependency-free for the scaffold.
 */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Today's date as `YYYY-MM-DD` in local time. */
export function todayIso(): string {
  const d = new Date();
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compose an ISO 8601 datetime string from an institution-local date + time.
 * We attach the device's current UTC offset so the server receives an
 * unambiguous instant. Booking is single-day (Section 6.7) so this is safe.
 */
export function isoToInstitutionDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM
  const local = new Date(`${date}T${time}:00`);
  return local.toISOString();
}

/** Render an RFC 3339 timestamp as a friendly local string. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Render only the time portion, e.g. "14:00". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Render only the date portion, e.g. "Mon, 28 Jun". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function weekdayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return DAY_LABELS[d.getDay()] ?? '';
}

/** Convert a wall-clock time string to total minutes for comparisons. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => Number.parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}
