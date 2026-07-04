import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  defaultLandingPath,
  hasPermission,
  permissionsForRole,
  safeRedirectPath,
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

  it("gives a super admin the override + user-management permissions", () => {
    const perms = permissionsForRole("SUPER_ADMIN");
    expect(perms).toContain("user.manage");
    expect(perms).toContain("booking.override");
    expect(perms).toContain("room.manage");
  });

  it("gives an admin approvals + timetable but not super-admin powers", () => {
    const perms = permissionsForRole("ADMIN");
    expect(perms).toContain("booking.approve");
    expect(perms).toContain("timetable.manage");
    expect(perms).not.toContain("booking.override");
    expect(perms).not.toContain("user.manage");
  });
});

describe("hasPermission", () => {
  it("returns true only when the permission is present", () => {
    const perms = permissionsForRole("ADMIN");
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
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("SUPER_ADMIN")).toBe(true);
  });
});

describe("defaultLandingPath", () => {
  it("sends requesters to /app and staff to /admin", () => {
    expect(defaultLandingPath("REQUESTER")).toBe("/app");
    expect(defaultLandingPath("SUPER_ADMIN")).toBe("/admin");
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin paths with search and hash", () => {
    expect(safeRedirectPath("/app/search?room=123#results", "/app")).toBe(
      "/app/search?room=123#results",
    );
  });

  it("falls back for external or protocol-relative destinations", () => {
    expect(safeRedirectPath("https://example.com", "/app")).toBe("/app");
    expect(safeRedirectPath("//example.com/login", "/app")).toBe("/app");
    expect(safeRedirectPath("/%2F%2Fexample.com", "/app")).toBe("/app");
  });

  it("falls back for malformed or backslash destinations", () => {
    expect(safeRedirectPath("%", "/admin")).toBe("/admin");
    expect(safeRedirectPath("/\\example.com", "/admin")).toBe("/admin");
    expect(safeRedirectPath("/app\n/admin", "/admin")).toBe("/admin");
    expect(safeRedirectPath("/app%0A/admin", "/admin")).toBe("/admin");
  });
});
