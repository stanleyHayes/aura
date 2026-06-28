import { z } from "zod";

/** Domain enums mirroring the Postgres custom types (§6.1). */

export const UserRole = z.enum([
  "SYSTEM_ADMIN",
  "TIMETABLE_ADMIN",
  "BOOKING_OFFICER",
  "REQUESTER",
]);
export type UserRole = z.infer<typeof UserRole>;

export const UserStatus = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);
export type UserStatus = z.infer<typeof UserStatus>;

export const RoomType = z.enum([
  "LECTURE_HALL",
  "LAB",
  "SEMINAR_ROOM",
  "AUDITORIUM",
  "CONFERENCE_ROOM",
]);
export type RoomType = z.infer<typeof RoomType>;

export const RoomStatus = z.enum(["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE"]);
export type RoomStatus = z.infer<typeof RoomStatus>;

export const SemesterStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type SemesterStatus = z.infer<typeof SemesterStatus>;

export const DayOfWeek = z.enum([
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

export const BookingStatus = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const ImportMethod = z.enum(["EXCEL", "CSV", "MANUAL"]);
export type ImportMethod = z.infer<typeof ImportMethod>;

export const ImportStatus = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "PARTIALLY_COMPLETED",
]);
export type ImportStatus = z.infer<typeof ImportStatus>;

export const NotifChannel = z.enum(["EMAIL", "IN_APP", "PUSH"]);
export type NotifChannel = z.infer<typeof NotifChannel>;

/** Calendar block source (§7.7). */
export const CalendarBlockSource = z.enum([
  "LECTURE",
  "BOOKING",
  "MAINTENANCE",
  "AVAILABLE",
]);
export type CalendarBlockSource = z.infer<typeof CalendarBlockSource>;

/** Human labels for UI rendering. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LECTURE_HALL: "Lecture hall",
  LAB: "Laboratory",
  SEMINAR_ROOM: "Seminar room",
  AUDITORIUM: "Auditorium",
  CONFERENCE_ROOM: "Conference room",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: "System administrator",
  TIMETABLE_ADMIN: "Timetable administrator",
  BOOKING_OFFICER: "Booking officer",
  REQUESTER: "Requester",
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};
