import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApi,
  isProblem,
  unwrap,
  type ProblemDetail,
} from "@cbs/api-client";

/**
 * The API client must work entirely offline in tests. We inject a fake `fetch`
 * into `createApi` (its documented per-request override) so no network or
 * running Go API is required, then assert the request shape and the
 * `unwrap` / `ApiError` problem-detail handling (§8.2).
 */

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

/** Extract the request URL string from whatever `fetch` was called with. */
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("createApi (with mocked fetch)", () => {
  it("issues a same-origin GET and returns the parsed body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse([{ id: "b1", code: "PB", name: "Petroleum Block" }]),
    );
    // openapi-fetch resolves the path against baseUrl via `new URL`, so the test
    // supplies an absolute origin. No real request is made — `fetch` is mocked.
    const api = createApi({ baseUrl: "http://localhost", fetch: fetchMock });

    const result = await api.GET("/api/v1/buildings");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrl(fetchMock.mock.calls[0]![0])).toContain("/api/v1/buildings");
    expect(result.error).toBeUndefined();
    expect(unwrap(result)).toEqual([
      { id: "b1", code: "PB", name: "Petroleum Block" },
    ]);
  });

  it("surfaces a problem-detail body as result.error", async () => {
    const problem: ProblemDetail = {
      title: "Unauthorised",
      status: 401,
      code: "AUTH_REQUIRED",
      detail: "You must sign in.",
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(problem, {
        status: 401,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );
    const api = createApi({ baseUrl: "http://localhost", fetch: fetchMock });

    const result = await api.GET("/api/v1/auth/me");
    expect(result.error).toBeDefined();
    expect(() => unwrap(result)).toThrowError(ApiError);
  });
});

describe("isProblem", () => {
  it("recognises a valid problem-detail object", () => {
    expect(isProblem({ title: "x", status: 400, code: "BAD" })).toBe(true);
  });

  it("rejects non-problem values", () => {
    expect(isProblem(null)).toBe(false);
    expect(isProblem("nope")).toBe(false);
    expect(isProblem({ title: "x" })).toBe(false);
  });
});

describe("unwrap", () => {
  it("returns data when there is no error", () => {
    const response = new Response(null, { status: 200 });
    expect(unwrap({ data: { ok: true }, response })).toEqual({ ok: true });
  });

  it("returns undefined for a 204-style empty body", () => {
    const response = new Response(null, { status: 204 });
    expect(unwrap({ response })).toBeUndefined();
  });

  it("throws a typed ApiError carrying the problem fields", () => {
    const problem: ProblemDetail = {
      title: "Conflict",
      status: 409,
      code: "BOOKING_CONFLICT",
      detail: "That room is already booked.",
    };
    const response = new Response(null, { status: 409 });
    try {
      unwrap({ error: problem, response });
      expect.unreachable("unwrap should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe("BOOKING_CONFLICT");
      expect(apiErr.message).toBe("That room is already booked.");
    }
  });

  it("wraps a non-problem error into an UNKNOWN ApiError", () => {
    const response = new Response(null, { status: 500, statusText: "Server Error" });
    try {
      unwrap({ error: "boom", response });
      expect.unreachable("unwrap should have thrown");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr).toBeInstanceOf(ApiError);
      expect(apiErr.code).toBe("UNKNOWN");
      expect(apiErr.status).toBe(500);
    }
  });
});
