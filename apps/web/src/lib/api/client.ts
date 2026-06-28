"use client";

import { createApi, unwrap, ApiError } from "@cbs/api-client";

/**
 * Browser API client (§9.2). Same-origin so the Next rewrite proxies to the Go
 * API and the httpOnly `__Host-*` cookies flow; the CSRF middleware in
 * `@cbs/api-client` attaches `X-CSRF-Token` on writes.
 */
export const api = createApi({ baseUrl: "" });

export { unwrap, ApiError };
