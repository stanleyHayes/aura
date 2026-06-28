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

/** Hour tick labels across the window. */
export function hourTicks(win: DisplayWindow): number[] {
  const ticks: number[] = [];
  for (let m = Math.ceil(win.startMin / 60) * 60; m <= win.endMin; m += 60) {
    ticks.push(m);
  }
  return ticks;
}
