import type { Route } from "next";

/**
 * Cast a runtime-computed string to a typed Route. Used only where the
 * destination is genuinely dynamic (e.g. a `?next=` redirect target or a
 * role-derived landing path) and therefore cannot be statically verified by
 * `typedRoutes`. The value still originates from our own controlled logic.
 */
export function route(path: string): Route {
  return path as Route;
}
