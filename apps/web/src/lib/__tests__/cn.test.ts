import { describe, expect, it } from "vitest";
import { cn } from "@cbs/ui/lib/cn";

/**
 * `cn` merges class names via clsx and resolves Tailwind conflicts via
 * tailwind-merge. These assert the two behaviours that callers depend on:
 * conditional inclusion, and last-write-wins for conflicting utilities.
 */

describe("cn", () => {
  it("joins multiple class strings", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("drops falsy / conditional values", () => {
    const isActive = false;
    expect(cn("base", isActive && "active", undefined, null)).toBe("base");
  });

  it("supports conditional object syntax (clsx)", () => {
    expect(cn("base", { hidden: false, block: true })).toBe("base block");
  });

  it("resolves conflicting Tailwind utilities, keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("returns an empty string when given no meaningful input", () => {
    expect(cn(false, null, undefined, "")).toBe("");
  });
});
