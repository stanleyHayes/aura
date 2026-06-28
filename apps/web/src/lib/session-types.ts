import type { components } from "@cbs/api-client";

/**
 * The session shape as returned by the API client (`GET /auth/me`). The Go API
 * is the authority for the permission set; on the client we treat permissions
 * as opaque strings and compare against the typed `Permission` union via the
 * helpers in `@/lib/auth`.
 */
export type AppSession = components["schemas"]["Session"];
export type AppUser = components["schemas"]["User"];
