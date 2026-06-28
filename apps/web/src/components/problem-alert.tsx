"use client";

import { TriangleAlert } from "lucide-react";
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
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  MFA_REQUIRED: "Enter your authentication code to continue.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
};

export function ProblemAlert({ error }: { error: unknown }) {
  if (!error) return null;

  let title = "Something went wrong";
  let detail = "Please try again.";

  if (error instanceof ApiError) {
    title = error.problem.title || title;
    detail = FRIENDLY[error.code] ?? error.problem.detail ?? detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
    </Alert>
  );
}
