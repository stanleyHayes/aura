/**
 * RFC 9457 problem+json handling (Section 8.2) for the mobile client.
 *
 * `code` is the stable machine string clients switch on (e.g.
 * `SLOT_NO_LONGER_AVAILABLE`, `ACCOUNT_LOCKED`). `errors[]` carries field-level
 * validation failures for 400/422 responses.
 */
import { ProblemSchema, type Problem } from '@/schemas';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly problem?: Problem;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status: number, problem?: Problem) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code;
    this.problem = problem;
    this.fieldErrors = {};
    for (const fe of problem?.errors ?? []) {
      this.fieldErrors[fe.field] = fe.message;
    }
  }

  /** True when retrying with a fresh access token might succeed. */
  get isUnauthorised(): boolean {
    return this.status === 401;
  }

  get isLocked(): boolean {
    return this.code === 'ACCOUNT_LOCKED' || this.status === 423;
  }

  get isSlotConflict(): boolean {
    return this.code === 'SLOT_NO_LONGER_AVAILABLE' || this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/**
 * Turn an unknown thrown value or a problem+json body into an {@link ApiError}.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const parsed = ProblemSchema.safeParse(body);
  if (parsed.success) {
    const p = parsed.data;
    return new ApiError(p.detail ?? p.title, p.status || status, p);
  }
  return new ApiError(defaultMessageForStatus(status), status);
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'The request was invalid.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'Not found.';
    case 409:
      return 'That slot is no longer available.';
    case 423:
      return 'Account locked. Try again later.';
    case 429:
      return 'Too many requests. Please slow down.';
    default:
      return status >= 500
        ? 'Something went wrong on our end.'
        : 'Request failed.';
  }
}

/** Friendly message for any caught error (network errors included). */
export function messageFromError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) {
    if (/network|fetch|timeout/i.test(err.message)) {
      return 'No connection. Check your network and try again.';
    }
    return err.message;
  }
  return 'Unexpected error.';
}
