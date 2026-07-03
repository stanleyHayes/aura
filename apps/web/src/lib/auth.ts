import type { Permission, UserRole } from "@cbs/schemas";

/**
 * Permission resolution mirrored from the API matrix (§9.4). The server is the
 * authority; this client-side copy gates UI affordances and route groups so we
 * never render an action the user can't perform. The API still enforces.
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  REQUESTER: ["booking.create", "booking.read.own", "availability.search"],
  BOOKING_OFFICER: [
    "booking.create",
    "booking.read.own",
    "booking.read.any",
    "booking.approve",
    "report.view",
    "availability.search",
  ],
  TIMETABLE_ADMIN: [
    "booking.create",
    "booking.read.own",
    "timetable.manage",
    "availability.search",
  ],
  SYSTEM_ADMIN: [
    "user.manage",
    "room.manage",
    "semester.manage",
    "timetable.manage",
    "booking.create",
    "booking.read.any",
    "booking.read.own",
    "booking.approve",
    "booking.override",
    "maintenance.manage",
    "report.view",
    "audit.view",
    "availability.search",
  ],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  permissions: readonly Permission[] | undefined,
  needed: Permission,
): boolean {
  return !!permissions?.includes(needed);
}

/** Whether a role may enter the admin console at all (§11). */
export function canAccessAdmin(role: UserRole): boolean {
  return role !== "REQUESTER";
}

/** The landing destination after login, by role. */
export function defaultLandingPath(role: UserRole): string {
  return canAccessAdmin(role) ? "/admin" : "/app";
}

/** Keep login `next` redirects same-origin even when the query is hand-edited. */
export function safeRedirectPath(
  candidate: string | undefined,
  fallback: string,
): string {
  const value = candidate?.trim();
  if (!value) return fallback;
  if (value.length > 2048) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (
    /[\u0000-\u001F\u007F]/.test(decoded) ||
    decoded.startsWith("//") ||
    decoded.includes("\\")
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://aura.local");
    if (url.origin !== "https://aura.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
