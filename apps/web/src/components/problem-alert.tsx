"use client";

import { ShieldAlert, TriangleAlert } from "lucide-react";
import { ApiError } from "@cbs/api-client";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";

/** Map known error codes (§8.2) to friendly, British-English copy. */
const FRIENDLY: Record<string, string> = {
  SLOT_NO_LONGER_AVAILABLE:
    "That slot has just been taken by another approved booking. Please choose a different time.",
  CONFLICTS_WITH_LECTURE:
    "This time clashes with a scheduled lecture, which always takes precedence.",
  CONFLICTS_WITH_MAINTENANCE:
    "This room is closed for maintenance during the requested time.",
  ATTENDEES_EXCEED_CAPACITY:
    "The number of attendees exceeds the room's capacity.",
  BOOKING_IN_PAST: "You cannot book a time in the past.",
  BOOKING_SPANS_MULTIPLE_DAYS: "A booking must fall within a single day.",
  INVALID_TRANSITION: "That action isn't allowed for this booking's status.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  MFA_REQUIRED: "Enter your authentication code to continue.",
  ACCOUNT_LOCKED: "Too many attempts — try again in a few minutes.",
  INVALID_MFA_CODE: "That authentication code was not accepted.",
  INVALID_TOKEN: "This reset link has expired. Request a new one to continue.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
};

export function ProblemAlert({ error }: { error: unknown }) {
  if (!error) return null;

  let title = "Something went wrong";
  let detail = "Please try again.";
  let status: number | undefined;
  let code: string | undefined;
  let fieldErrors: { field: string; message: string }[] = [];

  if (error instanceof ApiError) {
    title = error.problem.title || title;
    detail = FRIENDLY[error.code] ?? error.problem.detail ?? detail;
    status = error.status;
    code = error.code;
    fieldErrors = error.problem.errors ?? [];
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <Alert
      variant="destructive"
      className="border-[color-mix(in_oklch,var(--color-destructive)_38%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-destructive)_8%,var(--color-card))] p-4 shadow-sm [&>svg]:hidden [&>svg~*]:pl-0"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--color-destructive)_14%,transparent)] text-[var(--color-destructive)]"
        >
          {status === 403 ? (
            <ShieldAlert className="size-5" />
          ) : (
            <TriangleAlert className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTitle className="mb-0 text-[var(--color-foreground)]">
              {title}
            </AlertTitle>
            {status ? (
              <span className="rounded-full border border-[color-mix(in_oklch,var(--color-destructive)_24%,var(--color-border))] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--color-destructive)]">
                {status}
              </span>
            ) : null}
          </div>
          <AlertDescription className="mt-1 text-[var(--color-muted-foreground)] opacity-100">
            <p>{detail}</p>
            {fieldErrors.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-4">
                {fieldErrors.map((fieldError) => (
                  <li key={`${fieldError.field}:${fieldError.message}`}>
                    <span className="font-medium text-[var(--color-foreground)]">
                      {fieldError.field}
                    </span>
                    : {fieldError.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {code ? (
              <p className="mt-3 font-mono text-xs text-[color-mix(in_oklch,var(--color-muted-foreground)_76%,transparent)]">
                {code}
              </p>
            ) : null}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
