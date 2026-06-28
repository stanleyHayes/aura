import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  defaultLandingPath,
  hasPermission,
  permissionsForRole,
} from "@/lib/auth";

/**
 * Client-side permission resolution mirrors the API matrix (§9.4). These assert
 * the role -> permission mapping and the derived UI gates that decide which
 * surfaces a user can reach.
 */

describe("permissionsForRole", () => {
  it("gives a requester only the self-service permissions", () => {
    expect(permissionsForRole("REQUESTER")).toEqual([
      "booking.create",
      "booking.read.own",
      "availability.search",
    ]);
  });

  it("gives a system admin the override + user-management permissions", () => {
    const perms = permissionsForRole("SYSTEM_ADMIN");
    expect(perms).toContain("user.manage");
    expect(perms).toContain("booking.override");
    expect(perms).toContain("room.manage");
  });

  it("does not grant a booking officer the override permission", () => {
    expect(permissionsForRole("BOOKING_OFFICER")).not.toContain("booking.override");
  });
});

describe("hasPermission", () => {
  it("returns true only when the permission is present", () => {
    const perms = permissionsForRole("BOOKING_OFFICER");
    expect(hasPermission(perms, "booking.approve")).toBe(true);
    expect(hasPermission(perms, "booking.override")).toBe(false);
  });

  it("is safe with an undefined permission list", () => {
    expect(hasPermission(undefined, "booking.create")).toBe(false);
  });
});

describe("canAccessAdmin", () => {
  it("excludes requesters and admits every other role", () => {
    expect(canAccessAdmin("REQUESTER")).toBe(false);
    expect(canAccessAdmin("BOOKING_OFFICER")).toBe(true);
    expect(canAccessAdmin("TIMETABLE_ADMIN")).toBe(true);
    expect(canAccessAdmin("SYSTEM_ADMIN")).toBe(true);
  });
});

describe("defaultLandingPath", () => {
  it("sends requesters to /app and staff to /admin", () => {
    expect(defaultLandingPath("REQUESTER")).toBe("/app");
    expect(defaultLandingPath("SYSTEM_ADMIN")).toBe("/admin");
  });
});
