import { z } from "zod";

/** RFC 9457 problem+json error model (§8.2). */
export const ProblemFieldError = z.object({
  field: z.string(),
  message: z.string(),
});
export type ProblemFieldError = z.infer<typeof ProblemFieldError>;

export const Problem = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Stable machine code clients switch on (§8.2). */
  code: z.string(),
  errors: z.array(ProblemFieldError).optional(),
});
export type Problem = z.infer<typeof Problem>;

/** Known stable error codes referenced by the UI (§8.2, §7.3). */
export const ERROR_CODES = {
  SLOT_NO_LONGER_AVAILABLE: "SLOT_NO_LONGER_AVAILABLE",
  CONFLICTS_WITH_LECTURE: "CONFLICTS_WITH_LECTURE",
  CONFLICTS_WITH_MAINTENANCE: "CONFLICTS_WITH_MAINTENANCE",
  ATTENDEES_EXCEED_CAPACITY: "ATTENDEES_EXCEED_CAPACITY",
  BOOKING_IN_PAST: "BOOKING_IN_PAST",
  BOOKING_SPANS_MULTIPLE_DAYS: "BOOKING_SPANS_MULTIPLE_DAYS",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MFA_REQUIRED: "MFA_REQUIRED",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Cursor pagination envelope (§8.1). */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export interface Page<T> {
  data: T[];
  next_cursor: string | null;
}
