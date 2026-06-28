import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW,
  bandPosition,
  hhmm,
  hourTicks,
  minutesOfDay,
} from "@/lib/intervals";

/**
 * The availability grid positions time bands by converting HH:MM to minutes and
 * mapping them onto a fixed display window. These assert the maths is correct
 * and clamps to the window edges.
 */

describe("minutesOfDay", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("07:00")).toBe(420);
    expect(minutesOfDay("13:45")).toBe(825);
  });
});

describe("hhmm", () => {
  it("converts minutes back to a zero-padded HH:MM string", () => {
    expect(hhmm(0)).toBe("00:00");
    expect(hhmm(420)).toBe("07:00");
    expect(hhmm(825)).toBe("13:45");
  });

  it("clamps to a single day", () => {
    expect(hhmm(-30)).toBe("00:00");
    expect(hhmm(24 * 60 + 60)).toBe("24:00");
  });
});

describe("bandPosition", () => {
  it("computes left/width as percentages of the window span", () => {
    // 09:00–11:00 within the 07:00–21:00 (840 min) default window.
    const { left, width } = bandPosition(
      minutesOfDay("09:00"),
      minutesOfDay("11:00"),
      DEFAULT_WINDOW,
    );
    expect(left).toBeCloseTo((120 / 840) * 100, 5);
    expect(width).toBeCloseTo((120 / 840) * 100, 5);
  });

  it("clamps a band that starts before the window to the left edge", () => {
    const { left } = bandPosition(
      minutesOfDay("05:00"),
      minutesOfDay("08:00"),
      DEFAULT_WINDOW,
    );
    expect(left).toBe(0);
  });

  it("clamps width so a band cannot overflow the right edge", () => {
    const { left, width } = bandPosition(
      minutesOfDay("20:00"),
      minutesOfDay("23:00"),
      DEFAULT_WINDOW,
    );
    expect(left + width).toBeLessThanOrEqual(100);
  });
});

describe("hourTicks", () => {
  it("produces one tick per hour across the default window", () => {
    const ticks = hourTicks(DEFAULT_WINDOW);
    expect(ticks[0]).toBe(7 * 60);
    expect(ticks[ticks.length - 1]).toBe(21 * 60);
    expect(ticks).toHaveLength(15); // 07:00..21:00 inclusive
  });
});
