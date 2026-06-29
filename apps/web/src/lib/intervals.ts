/**
 * Client-side interval helpers for rendering the availability grid (§7.1).
 * NOTE: the authoritative availability computation happens server-side; these
 * helpers only position bands within a fixed display window.
 */

/** Minutes since midnight for a `HH:MM` string. */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** `HH:MM` for minutes since midnight (clamped to a day). */
export function hhmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface DisplayWindow {
  /** Window start in minutes (e.g. 07:00 → 420). */
  startMin: number;
  /** Window end in minutes (e.g. 21:00 → 1260). */
  endMin: number;
}

export const DEFAULT_WINDOW: DisplayWindow = {
  startMin: 7 * 60,
  endMin: 21 * 60,
};

/** Left % and width % for a [start,end] band within the window. */
export function bandPosition(
  startMin: number,
  endMin: number,
  win: DisplayWindow,
): { left: number; width: number } {
  const span = win.endMin - win.startMin;
  const left = ((startMin - win.startMin) / span) * 100;
  const width = ((endMin - startMin) / span) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0, Math.min(100 - Math.max(0, left), width)),
  };
}

/**
 * Combine a local `YYYY-MM-DD` date and `HH:MM` time interpreted in `timeZone`
 * into an RFC 3339 UTC instant (e.g. for the booking create endpoint, which
 * expects `starts_at`/`ends_at`). Robust to the zone's UTC offset.
 */
export function localToRfc3339(
  date: string,
  time: string,
  timeZone: string,
): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Provisional UTC guess, then correct by the zone offset at that instant.
  const guess = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const asUtc = new Date(guess);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(asUtc).map((p) => [p.type, p.value]),
  );
  const tzWall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // offset = (what the zone shows for `asUtc`) − (the UTC instant) → subtract it.
  const offset = tzWall - guess;
  return new Date(guess - offset).toISOString();
}

/** Hour tick labels across the window. */
export function hourTicks(win: DisplayWindow): number[] {
  const ticks: number[] = [];
  for (let m = Math.ceil(win.startMin / 60) * 60; m <= win.endMin; m += 60) {
    ticks.push(m);
  }
  return ticks;
}
