import type { CalendarBlock } from "@cbs/schemas";

type CalendarIdentityBlock = Pick<
  CalendarBlock,
  "source" | "room_id" | "date" | "start" | "end"
>;

/**
 * Schedule-X validates event ids as CSS-queryable identifiers. Calendar blocks
 * include time strings such as "00:00", so every generated id must be normalised
 * before it reaches the library.
 */
export function scheduleXEventId(
  block: CalendarIdentityBlock,
  index: number,
): string {
  return [
    "sx",
    block.source,
    block.room_id,
    block.date,
    block.start,
    block.end,
    String(index),
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
