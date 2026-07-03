import "server-only";
import { cookies, headers } from "next/headers";
import { createApi, type ProblemDetail } from "@cbs/api-client";
import { apiOrigin } from "@/lib/env";

/**
 * Server-side API client for RSC / route handlers / Server Actions (§10.1).
 *
 * The browser uses the Next rewrite + httpOnly `__Host-*` cookies (§9.2). On
 * the server we cannot rely on the rewrite, so we call the API origin directly
 * and forward the inbound cookies (and CSRF on writes) explicitly.
 */
export async function serverApi() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  // Production uses the `__Host-csrf` cookie (secure); dev uses `cbs_csrf`.
  // Check the production name FIRST or server-side writes (e.g. logout) omit the
  // double-submit header and the API rejects them with 403.
  const csrf =
    cookieStore.get("__Host-csrf")?.value ??
    cookieStore.get("cbs_csrf")?.value ??
    cookieStore.get("cbs-csrf")?.value;

  const fwdHeaders: Record<string, string> = {};
  if (cookieHeader) fwdHeaders["cookie"] = cookieHeader;
  if (csrf) fwdHeaders["X-CSRF-Token"] = csrf;

  return createApi({ baseUrl: apiOrigin, headers: fwdHeaders });
}

/**
 * Load the current session (§8.3 GET /auth/me). Returns null when the caller
 * is unauthenticated, so callers decide whether to redirect.
 */
export async function getSession() {
  const api = await serverApi();
  const { data, error } = await api.GET("/api/v1/auth/me");
  if (error || !data) return null;
  return data;
}

/** Forward the inbound noindex hint (used to set X-Robots-Tag in layouts). */
export async function isAuthenticatedSurface(): Promise<boolean> {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  return pathname.startsWith("/app") || pathname.startsWith("/admin");
}

export type { ProblemDetail };
