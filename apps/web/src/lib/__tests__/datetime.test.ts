import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INSTITUTION_TZ,
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeRange,
  institutionTz,
  toInstitutionDateKey,
} from "@cbs/ui/lib/datetime";

/**
 * The datetime helpers MUST render in the institution timezone (Africa/Accra,
 * UTC+0, no DST) regardless of the system / browser zone. We assert that by
 * feeding a UTC instant and an explicit `tz`, and by checking the env-driven
 * default.
 */

// A known UTC instant: 2026-06-28 22:30 UTC.
// In Africa/Accra (UTC+0) that is 22:30 the same day.
// In America/New_York (UTC-4 in summer) that would be 18:30 — the difference
// is what proves the formatter ignores the system zone.
const INSTANT = "2026-06-28T22:30:00Z";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_TZ;
});

describe("institutionTz", () => {
  it("falls back to Africa/Accra when no env override is set", () => {
    delete process.env.NEXT_PUBLIC_APP_TZ;
    expect(institutionTz()).toBe(DEFAULT_INSTITUTION_TZ);
    expect(DEFAULT_INSTITUTION_TZ).toBe("Africa/Accra");
  });

  it("honours NEXT_PUBLIC_APP_TZ when provided", () => {
    process.env.NEXT_PUBLIC_APP_TZ = "Europe/London";
    expect(institutionTz()).toBe("Europe/London");
  });
});

describe("formatTime", () => {
  it("formats a UTC instant in Africa/Accra (UTC+0) by default", () => {
    expect(formatTime(INSTANT)).toBe("22:30");
  });

  it("formats the same instant differently in a different tz", () => {
    // New York is UTC-4 in late June, so 22:30Z becomes 18:30 local.
    expect(formatTime(INSTANT, { tz: "America/New_York" })).toBe("18:30");
  });

  it("does not depend on a process env when an explicit tz is passed", () => {
    process.env.NEXT_PUBLIC_APP_TZ = "America/New_York";
    expect(formatTime(INSTANT, { tz: "Africa/Accra" })).toBe("22:30");
  });
});

describe("formatDate", () => {
  it("renders the institution-local calendar date", () => {
    // 22:30Z on the 28th is still the 28th in Accra.
    expect(formatDate(INSTANT)).toBe("Sun, 28 Jun 2026");
  });

  it("can roll over to the previous day in a behind-UTC zone", () => {
    // 00:30Z on the 29th is 20:30 on the 28th in New York.
    expect(formatDate("2026-06-29T00:30:00Z", { tz: "America/New_York" })).toBe(
      "Sun, 28 Jun 2026",
    );
  });
});

describe("formatDateTime", () => {
  it("combines date and 24-hour time in the institution tz", () => {
    expect(formatDateTime(INSTANT)).toBe("Sun, 28 Jun 2026, 22:30");
  });
});

describe("formatTimeRange", () => {
  it("joins two instants with an en dash", () => {
    expect(formatTimeRange("2026-06-28T09:00:00Z", "2026-06-28T11:00:00Z")).toBe(
      "09:00 – 11:00",
    );
  });
});

describe("toInstitutionDateKey", () => {
  it("yields a YYYY-MM-DD key in the institution tz", () => {
    expect(toInstitutionDateKey(INSTANT)).toBe("2026-06-28");
  });

  it("respects the requested tz when computing the calendar day", () => {
    expect(
      toInstitutionDateKey("2026-06-29T00:30:00Z", { tz: "America/New_York" }),
    ).toBe("2026-06-28");
  });
});
