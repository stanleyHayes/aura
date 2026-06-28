/**
 * Typed CBS API client (§5.2, §8). Built on `openapi-fetch` over the
 * hand-authored `paths` contract in `./schema`.
 *
 * The web app uses httpOnly cookies (§9.2), so the browser-side client relies
 * on the Next.js rewrite of `/api/v1/*` and `credentials: "include"`; the
 * double-submit CSRF header is attached by a middleware on state-changing
 * requests. The server-side client (RSC / route handlers) forwards the
 * incoming cookies explicitly. Both share this factory.
 */
import createClient, { type Client, type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

export type { paths } from "./schema";
export type { components, Page } from "./schema";

export interface CreateApiOptions {
  /** Base URL. Browser: same-origin (""), so the Next rewrite proxies. */
  baseUrl?: string;
  /** Extra headers (e.g. forwarded Cookie / CSRF on the server). */
  headers?: Record<string, string>;
  /** Per-request fetch override (server components). */
  fetch?: typeof fetch;
}

const CSRF_COOKIE = "cbs-csrf";
const CSRF_HEADER = "X-CSRF-Token";
const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]!) : undefined;
}

/**
 * Browser middleware: attach the double-submit CSRF token from the readable
 * `cbs-csrf` cookie to every state-changing request (§9.2).
 */
const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    if (STATE_CHANGING.has(request.method.toUpperCase())) {
      const token = readCookie(CSRF_COOKIE);
      if (token) request.headers.set(CSRF_HEADER, token);
    }
    return request;
  },
};

export function createApi(opts: CreateApiOptions = {}): Client<paths> {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl ?? "",
    credentials: "include",
    headers: opts.headers,
    fetch: opts.fetch,
  });
  if (typeof document !== "undefined") {
    client.use(csrfMiddleware);
  }
  return client;
}

// ── Problem-detail helpers (§8.2) ─────────────────────────────────────────

export interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  errors?: { field: string; message: string }[];
}

/** A thrown error carrying the RFC 9457 problem body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetail;
  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
  }
}

export function isProblem(value: unknown): value is ProblemDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    "title" in value
  );
}

/**
 * Unwrap an openapi-fetch `{ data, error }` result, throwing `ApiError` on a
 * problem response. Keeps call sites terse and consistently typed.
 */
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (result.error !== undefined && result.error !== null) {
    if (isProblem(result.error)) throw new ApiError(result.error);
    throw new ApiError({
      title: "Request failed",
      status: result.response.status,
      code: "UNKNOWN",
      detail:
        typeof result.error === "string" ? result.error : result.response.statusText,
    });
  }
  if (result.data === undefined) {
    // 204 No Content etc.
    return undefined as T;
  }
  return result.data;
}

export const CSRF = { COOKIE: CSRF_COOKIE, HEADER: CSRF_HEADER };
