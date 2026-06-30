import { describe, expect, it } from "vitest";
import { scheduleXEventId } from "@/lib/calendar-events";

describe("scheduleXEventId", () => {
  it("normalises availability blocks with colon times into CSS-queryable ids", () => {
    const id = scheduleXEventId(
      {
        source: "AVAILABLE",
        room_id: "019f142e-f7af-7fbe-a8ce-9df5a2baacda",
        date: "2026-06-29",
        start: "00:00",
        end: "09:30",
      },
      0,
    );

    expect(id).toBe(
      "sx-available-019f142e-f7af-7fbe-a8ce-9df5a2baacda-2026-06-29-00-00-09-30-0",
    );
    expect(() => document.querySelector(`#${id}`)).not.toThrow();
  });
});
