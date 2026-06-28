import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS_LABELS,
  Booking,
  CreateBookingForm,
  LoginForm,
  ResetPasswordForm,
  Room,
  RoomForm,
} from "@cbs/schemas";

/**
 * Validation tests for the shared zod contract (@cbs/schemas).
 * These assert both the happy path and the British-English error messages /
 * cross-field refinements that the web forms rely on.
 */

describe("LoginForm", () => {
  it("accepts a valid email + password with no MFA code", () => {
    const result = LoginForm.safeParse({
      email: "lecturer@knust.edu.gh",
      password: "hunter2hunter2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid six-digit MFA code", () => {
    const result = LoginForm.safeParse({
      email: "lecturer@knust.edu.gh",
      password: "hunter2hunter2",
      mfa_code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email with the expected message", () => {
    const result = LoginForm.safeParse({
      email: "not-an-email",
      password: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "email");
      expect(issue?.message).toBe("Enter a valid email address.");
    }
  });

  it("rejects an MFA code that is not exactly six digits", () => {
    const result = LoginForm.safeParse({
      email: "lecturer@knust.edu.gh",
      password: "x",
      mfa_code: "12ab5",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateBookingForm", () => {
  const base = {
    room_id: "11111111-1111-4111-8111-111111111111",
    date: "2026-06-30",
    start: "09:00",
    end: "11:00",
    purpose: "Departmental seminar",
    attendee_count: 25,
  };

  it("accepts a well-formed booking request", () => {
    expect(CreateBookingForm.safeParse(base).success).toBe(true);
  });

  it("rejects when end is not after start (cross-field refinement)", () => {
    const result = CreateBookingForm.safeParse({ ...base, start: "11:00", end: "09:00" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "end");
      expect(issue?.message).toBe("The end time must be after the start time.");
    }
  });

  it("rejects a non-UUID room id", () => {
    expect(CreateBookingForm.safeParse({ ...base, room_id: "abc" }).success).toBe(false);
  });

  it("rejects a malformed time-of-day", () => {
    expect(CreateBookingForm.safeParse({ ...base, start: "9:00" }).success).toBe(false);
    expect(CreateBookingForm.safeParse({ ...base, end: "25:00" }).success).toBe(false);
  });

  it("rejects a too-short purpose and a zero attendee count", () => {
    expect(CreateBookingForm.safeParse({ ...base, purpose: "ab" }).success).toBe(false);
    expect(CreateBookingForm.safeParse({ ...base, attendee_count: 0 }).success).toBe(false);
  });
});

describe("ResetPasswordForm", () => {
  it("requires the password and confirmation to match", () => {
    const result = ResetPasswordForm.safeParse({
      token: "t",
      password: "longenoughpw1",
      confirm: "different-value",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "confirm");
      expect(issue?.message).toBe("The passwords do not match.");
    }
  });

  it("enforces the 12-character minimum", () => {
    const result = ResetPasswordForm.safeParse({
      token: "t",
      password: "short",
      confirm: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a matching, long-enough password", () => {
    const result = ResetPasswordForm.safeParse({
      token: "t",
      password: "averylongpassword",
      confirm: "averylongpassword",
    });
    expect(result.success).toBe(true);
  });
});

describe("RoomForm", () => {
  it("rejects an invalid room_type enum value", () => {
    const result = RoomForm.safeParse({
      room_code: "PB-201",
      name: "Petroleum Block 201",
      building_id: "22222222-2222-4222-a222-222222222222",
      capacity: 60,
      room_type: "BALLROOM",
      status: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid room definition", () => {
    const result = RoomForm.safeParse({
      room_code: "PB-201",
      name: "Petroleum Block 201",
      building_id: "22222222-2222-4222-a222-222222222222",
      capacity: 60,
      room_type: "LECTURE_HALL",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });
});

describe("entity schemas", () => {
  it("parses a Room and applies the default empty equipment array", () => {
    const result = Room.safeParse({
      id: "33333333-3333-4333-b333-333333333333",
      room_code: "PB-201",
      name: "Petroleum Block 201",
      building_id: "22222222-2222-4222-a222-222222222222",
      capacity: 60,
      room_type: "LECTURE_HALL",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.equipment).toEqual([]);
    }
  });

  it("rejects a Booking with a non-RFC3339 timestamp", () => {
    const result = Booking.safeParse({
      id: "44444444-4444-4444-8444-444444444444",
      room_id: "33333333-3333-4333-b333-333333333333",
      requested_by: "55555555-5555-4555-9555-555555555555",
      purpose: "Lab session",
      attendee_count: 10,
      starts_at: "2026-06-30 09:00",
      ends_at: "2026-06-30T11:00:00Z",
      status: "PENDING",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("enum labels", () => {
  it("maps every booking status to a human label", () => {
    expect(BOOKING_STATUS_LABELS.PENDING).toBe("Pending");
    expect(BOOKING_STATUS_LABELS.APPROVED).toBe("Approved");
    expect(Object.keys(BOOKING_STATUS_LABELS)).toHaveLength(5);
  });
});
