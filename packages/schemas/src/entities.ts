import { z } from "zod";
import {
  BookingStatus,
  CalendarBlockSource,
  DayOfWeek,
  ImportStatus,
  NotifChannel,
  RoomStatus,
  RoomType,
  SemesterStatus,
  UserRole,
  UserStatus,
} from "./enums";

/** Common scalars. */
export const Uuid = z.string().uuid();
export const Instant = z.string().datetime({ offset: true }); // RFC 3339 UTC (§8.1)
export const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/); // HH:MM

/** Entities (§6). */

export const Department = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
  faculty: z.string().nullable().optional(),
  created_at: Instant,
  updated_at: Instant,
});
export type Department = z.infer<typeof Department>;

export const User = z.object({
  id: Uuid,
  email: z.string().email(),
  full_name: z.string(),
  role: UserRole,
  status: UserStatus,
  department_id: Uuid.nullable().optional(),
  department: Department.nullable().optional(),
  mfa_enabled: z.boolean(),
  last_login_at: Instant.nullable().optional(),
  created_at: Instant,
  updated_at: Instant,
});
export type User = z.infer<typeof User>;

export const Permission = z.enum([
  "user.manage",
  "room.manage",
  "semester.manage",
  "timetable.manage",
  "booking.create",
  "booking.read.any",
  "booking.read.own",
  "booking.approve",
  "booking.override",
  "maintenance.manage",
  "report.view",
  "availability.search",
]);
export type Permission = z.infer<typeof Permission>;

/** /auth/me response (§8.3). */
export const Session = z.object({
  user: User,
  permissions: z.array(Permission),
});
export type Session = z.infer<typeof Session>;

export const Building = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
  campus: z.string().nullable().optional(),
  created_at: Instant,
  updated_at: Instant,
});
export type Building = z.infer<typeof Building>;

export const Equipment = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
});
export type Equipment = z.infer<typeof Equipment>;

export const RoomEquipment = z.object({
  equipment_id: Uuid,
  code: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
});
export type RoomEquipment = z.infer<typeof RoomEquipment>;

export const Room = z.object({
  id: Uuid,
  room_code: z.string(),
  name: z.string(),
  building_id: Uuid,
  building: Building.nullable().optional(),
  capacity: z.number().int().positive(),
  room_type: RoomType,
  status: RoomStatus,
  equipment: z.array(RoomEquipment).default([]),
  created_at: Instant,
  updated_at: Instant,
});
export type Room = z.infer<typeof Room>;

export const Semester = z.object({
  id: Uuid,
  name: z.string(),
  start_date: DateKey,
  end_date: DateKey,
  status: SemesterStatus,
  created_at: Instant,
  updated_at: Instant,
});
export type Semester = z.infer<typeof Semester>;

export const TimetableEvent = z.object({
  id: Uuid,
  semester_id: Uuid,
  room_id: Uuid,
  room_code: z.string().optional(),
  course_code: z.string(),
  course_title: z.string(),
  lecturer_name: z.string(),
  day: DayOfWeek,
  start_time: TimeOfDay,
  end_time: TimeOfDay,
  created_at: Instant,
});
export type TimetableEvent = z.infer<typeof TimetableEvent>;

export const ImportErrorRow = z.object({
  row: z.number().int(),
  field: z.string().nullable().optional(),
  message: z.string(),
});
export type ImportErrorRow = z.infer<typeof ImportErrorRow>;

export const TimetableImport = z.object({
  id: Uuid,
  semester_id: Uuid,
  uploaded_by: Uuid,
  method: z.enum(["EXCEL", "CSV", "MANUAL"]),
  status: ImportStatus,
  total_rows: z.number().int(),
  imported_rows: z.number().int(),
  error_rows: z.number().int(),
  error_report: z.array(ImportErrorRow).nullable().optional(),
  created_at: Instant,
  completed_at: Instant.nullable().optional(),
});
export type TimetableImport = z.infer<typeof TimetableImport>;

export const Booking = z.object({
  id: Uuid,
  room_id: Uuid,
  room: Room.nullable().optional(),
  requested_by: Uuid,
  requester: User.nullable().optional(),
  purpose: z.string(),
  attendee_count: z.number().int().positive(),
  starts_at: Instant,
  ends_at: Instant,
  status: BookingStatus,
  reviewed_by: Uuid.nullable().optional(),
  reviewer: User.nullable().optional(),
  review_note: z.string().nullable().optional(),
  reviewed_at: Instant.nullable().optional(),
  cancelled_at: Instant.nullable().optional(),
  created_at: Instant,
  updated_at: Instant,
});
export type Booking = z.infer<typeof Booking>;

/** A blocker explaining why a pending booking cannot be approved (§11). */
export const ApprovalBlocker = z.object({
  kind: z.enum([
    "LECTURE",
    "MAINTENANCE",
    "APPROVED_BOOKING",
    "COMPETING_PENDING",
    "CAPACITY",
    "IN_PAST",
  ]),
  message: z.string(),
  // Optional context for rendering the conflicting interval.
  starts_at: Instant.nullable().optional(),
  ends_at: Instant.nullable().optional(),
  reference: z.string().nullable().optional(),
});
export type ApprovalBlocker = z.infer<typeof ApprovalBlocker>;

/** Booking enriched with approvability info, used on the approvals queue. */
export const BookingApprovability = z.object({
  booking: Booking,
  can_approve: z.boolean(),
  blockers: z.array(ApprovalBlocker).default([]),
  competing_pending_count: z.number().int().default(0),
});
export type BookingApprovability = z.infer<typeof BookingApprovability>;

export const MaintenanceWindow = z.object({
  id: Uuid,
  room_id: Uuid,
  room: Room.nullable().optional(),
  starts_at: Instant,
  ends_at: Instant,
  reason: z.string(),
  created_by: Uuid,
  created_at: Instant,
});
export type MaintenanceWindow = z.infer<typeof MaintenanceWindow>;

export const Notification = z.object({
  id: Uuid,
  user_id: Uuid,
  channel: NotifChannel,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  related_entity_type: z.string().nullable().optional(),
  related_entity_id: Uuid.nullable().optional(),
  read_at: Instant.nullable().optional(),
  created_at: Instant,
});
export type Notification = z.infer<typeof Notification>;

export const AuditLog = z.object({
  id: Uuid,
  actor_id: Uuid.nullable().optional(),
  actor_name: z.string().nullable().optional(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: Uuid.nullable().optional(),
  changes: z.unknown().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  created_at: Instant,
});
export type AuditLog = z.infer<typeof AuditLog>;

/** Free time interval on a given day, from the availability engine (§7.1). */
export const FreeInterval = z.object({
  start: TimeOfDay,
  end: TimeOfDay,
});
export type FreeInterval = z.infer<typeof FreeInterval>;

export const AvailabilityResult = z.object({
  room: Room,
  free_intervals: z.array(FreeInterval),
});
export type AvailabilityResult = z.infer<typeof AvailabilityResult>;

/** A unified calendar block (§7.7). */
export const CalendarBlock = z.object({
  source: CalendarBlockSource,
  title: z.string(),
  room_id: Uuid,
  room_code: z.string().optional(),
  starts_at: Instant,
  ends_at: Instant,
  booking_status: BookingStatus.nullable().optional(),
  reference_id: Uuid.nullable().optional(),
});
export type CalendarBlock = z.infer<typeof CalendarBlock>;

/** Reporting payloads (§7.9). */
export const UtilisationRow = z.object({
  room_id: Uuid,
  room_code: z.string(),
  room_name: z.string(),
  building_name: z.string(),
  lecture_hours: z.number(),
  booked_hours: z.number(),
  available_hours: z.number(),
  utilisation_pct: z.number(),
});
export type UtilisationRow = z.infer<typeof UtilisationRow>;

export const UtilisationReport = z.object({
  rows: z.array(UtilisationRow),
  totals: z.object({
    lecture_hours: z.number(),
    booked_hours: z.number(),
    available_hours: z.number(),
    utilisation_pct: z.number(),
  }),
});
export type UtilisationReport = z.infer<typeof UtilisationReport>;

export const BookingReport = z.object({
  total: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
  pending: z.number().int(),
  cancelled: z.number().int(),
  approval_rate_pct: z.number(),
  by_department: z.array(
    z.object({ department: z.string(), count: z.number().int() }),
  ),
  by_building: z.array(
    z.object({ building: z.string(), count: z.number().int() }),
  ),
});
export type BookingReport = z.infer<typeof BookingReport>;

export const ConflictReport = z.object({
  rejected_requests: z.number().int(),
  lecture_clashes: z.number().int(),
  maintenance_clashes: z.number().int(),
  competing_pending: z.number().int(),
  rows: z.array(
    z.object({
      date: DateKey,
      room_code: z.string(),
      reason: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type ConflictReport = z.infer<typeof ConflictReport>;
