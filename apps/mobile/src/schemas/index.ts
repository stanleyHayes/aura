/**
 * Zod v4 schemas for the Classroom Booking System mobile app.
 *
 * This is a LOCAL copy that keeps `apps/mobile` self-contained. The canonical
 * schemas are generated/maintained in `/packages/schemas` and shared with the
 * web app (Section 13). The shapes here mirror the data model (Section 6) and
 * the REST payloads (Section 8).
 *
 * TODO(packages): replace this module with `export * from '@cbs/schemas'` once
 * the shared workspace package is available.
 *
 * British English is used throughout user-facing copy ("authorise", "centre",
 * "cancelled", "utilisation").
 */
/* eslint-disable @typescript-eslint/no-redeclare -- zod schemas intentionally export a runtime schema and matching inferred type with the same name. */
import { z } from 'zod';

/* ------------------------------------------------------------------ enums -- */

export const UserRole = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'REQUESTER',
]);
export type UserRole = z.infer<typeof UserRole>;

export const RoomType = z.enum([
  'LECTURE_HALL',
  'LAB',
  'SEMINAR_ROOM',
  'AUDITORIUM',
  'CONFERENCE_ROOM',
]);
export type RoomType = z.infer<typeof RoomType>;

export const RoomStatus = z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']);
export type RoomStatus = z.infer<typeof RoomStatus>;

export const BookingStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const NotifChannel = z.enum(['EMAIL', 'IN_APP', 'PUSH']);
export type NotifChannel = z.infer<typeof NotifChannel>;

export const CalendarSource = z.enum([
  'LECTURE',
  'BOOKING',
  'MAINTENANCE',
  'AVAILABLE',
]);
export type CalendarSource = z.infer<typeof CalendarSource>;

/* --------------------------------------------------------------- helpers -- */

const uuid = z.string().uuid();
/** RFC 3339 UTC timestamp string (Section 8.1). */
const datetime = z.string();
/** ISO date `YYYY-MM-DD`. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
/** Time-of-day `HH:MM` (24-hour, institution-local). */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24-hour)');

/* ------------------------------------------------------------- identity --- */

export const Permission = z.string();

export const MeSchema = z.object({
  id: uuid,
  email: z.string().email(),
  fullName: z.string(),
  role: UserRole,
  departmentId: uuid.nullable().optional(),
  permissions: z.array(Permission).default([]),
});
export type Me = z.infer<typeof MeSchema>;

export const AuthTokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().optional(),
  // Seconds until the access token expires (15 min per Section 9.1).
  expires_in: z.number().int().positive().optional(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/** Server may return tokens + user together on login. */
export const LoginResponseSchema = AuthTokensSchema.extend({
  user: MeSchema.optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/* ------------------------------------------------------------- catalogue -- */

export const BuildingSchema = z.object({
  id: uuid,
  code: z.string(),
  name: z.string(),
  campus: z.string().nullable().optional(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const EquipmentSchema = z.object({
  id: uuid,
  code: z.string(),
  name: z.string(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const RoomEquipmentSchema = EquipmentSchema.extend({
  quantity: z.number().int().positive().default(1),
});
export type RoomEquipment = z.infer<typeof RoomEquipmentSchema>;

export const RoomSchema = z.object({
  id: uuid,
  roomCode: z.string(),
  name: z.string(),
  buildingId: uuid,
  building: BuildingSchema.optional(),
  /** Flat building fields returned on the room list projection (parity with web). */
  buildingCode: z.string().nullable().optional(),
  buildingName: z.string().nullable().optional(),
  capacity: z.number().int().positive(),
  roomType: RoomType,
  status: RoomStatus,
  /** Cover image + gallery (rooms now carry media — parity with web). */
  imageUrl: z.string().nullable().optional(),
  galleryUrls: z.array(z.string()).default([]),
  equipment: z.array(RoomEquipmentSchema).default([]),
});
export type Room = z.infer<typeof RoomSchema>;

/* ---------------------------------------------------------- availability -- */

/** A free sub-interval returned by the availability engine (Section 7.1). */
export const FreeIntervalSchema = z.object({
  start: timeOfDay,
  end: timeOfDay,
});
export type FreeInterval = z.infer<typeof FreeIntervalSchema>;

export const AvailabilityResultSchema = z.object({
  room: RoomSchema,
  capacity: z.number().int().positive(),
  freeIntervals: z.array(FreeIntervalSchema).default([]),
});
export type AvailabilityResult = z.infer<typeof AvailabilityResultSchema>;

/** Query params for `GET /availability/search` (FR6, Section 8.3). */
export const AvailabilitySearchSchema = z
  .object({
    date: isoDate,
    start: timeOfDay,
    end: timeOfDay,
    buildingId: uuid.optional(),
    minCapacity: z.number().int().positive().optional(),
    roomType: RoomType.optional(),
    equipment: z.array(z.string()).optional(),
  })
  .refine((v) => v.end > v.start, {
    message: 'End time must be after start time',
    path: ['end'],
  });
export type AvailabilitySearch = z.infer<typeof AvailabilitySearchSchema>;

/* -------------------------------------------------------------- bookings -- */

/**
 * A blocker explaining why a pending booking cannot be approved (parity with
 * the web approvals queue / §11). Surfaced inline so officers can resolve a
 * conflict without guessing.
 */
export const ApprovalBlockerSchema = z.object({
  kind: z.enum([
    'LECTURE',
    'MAINTENANCE',
    'APPROVED_BOOKING',
    'COMPETING_PENDING',
    'CAPACITY',
    'IN_PAST',
  ]),
  message: z.string(),
  startsAt: datetime.nullable().optional(),
  endsAt: datetime.nullable().optional(),
  reference: z.string().nullable().optional(),
});
export type ApprovalBlocker = z.infer<typeof ApprovalBlockerSchema>;

export const BookingSummarySchema = z.object({
  id: uuid,
  roomId: uuid,
  room: RoomSchema.optional(),
  requestedBy: uuid,
  requesterName: z.string().optional(),
  purpose: z.string(),
  attendeeCount: z.number().int().positive(),
  startsAt: datetime,
  endsAt: datetime,
  status: BookingStatus,
  reviewNote: z.string().nullable().optional(),
  reviewedAt: datetime.nullable().optional(),
  createdAt: datetime,
  /**
   * Approvability info the pending (officer) scope may attach to each row. The
   * mobile list endpoint returns plain rows today; these optional fields let the
   * approvals screen render the web's "why" panel when the API enriches them and
   * degrade gracefully when it does not.
   */
  canApprove: z.boolean().optional(),
  blockers: z.array(ApprovalBlockerSchema).optional(),
  competingPendingCount: z.number().int().optional(),
});
export type BookingSummary = z.infer<typeof BookingSummarySchema>;

export const BookingDetailSchema = BookingSummarySchema.extend({
  reviewedBy: uuid.nullable().optional(),
  reviewerName: z.string().nullable().optional(),
  cancelledAt: datetime.nullable().optional(),
  updatedAt: datetime.optional(),
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;

/**
 * Booking request form (FR7). Validated client-side; mirrors the server-side
 * trigger invariants (Section 6.7): not-in-past, single local day, capacity.
 * Times are institution-local; the API layer composes RFC 3339 timestamps.
 */
export const BookingRequestSchema = z
  .object({
    roomId: uuid,
    date: isoDate,
    start: timeOfDay,
    end: timeOfDay,
    purpose: z.string().min(3, 'Please describe the purpose').max(500),
    // The form field coerces text → number on change, so we validate a number
    // here (keeps input/output types aligned for react-hook-form's resolver).
    attendeeCount: z
      .number()
      .int('Must be a whole number')
      .positive('At least one attendee'),
  })
  .refine((v) => v.end > v.start, {
    message: 'End time must be after start time',
    path: ['end'],
  });
export type BookingRequest = z.infer<typeof BookingRequestSchema>;

/** Officer approve/reject note (reject requires a note — Section 8.3). */
export const ReviewDecisionSchema = z.object({
  note: z.string().max(500).optional(),
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const RejectDecisionSchema = z.object({
  note: z.string().min(3, 'A note is required when rejecting').max(500),
});
export type RejectDecision = z.infer<typeof RejectDecisionSchema>;

/* ---------------------------------------------------------- notifications -- */

export const NotificationSchema = z.object({
  id: uuid,
  channel: NotifChannel,
  type: z.string(), // BOOKING_SUBMITTED | APPROVED | REJECTED | CANCELLED | REMINDER
  title: z.string(),
  body: z.string(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: uuid.nullable().optional(),
  readAt: datetime.nullable().optional(),
  createdAt: datetime,
});
export type Notification = z.infer<typeof NotificationSchema>;

/* ------------------------------------------------------------- calendar --- */

export const CalendarBlockSchema = z.object({
  id: z.string(),
  source: CalendarSource,
  title: z.string(),
  startsAt: datetime,
  endsAt: datetime,
  roomId: uuid.optional(),
  status: BookingStatus.optional(),
});
export type CalendarBlock = z.infer<typeof CalendarBlockSchema>;

/* --------------------------------------------------------------- errors --- */

/** RFC 9457 problem+json (Section 8.2). */
export const ProblemFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ProblemSchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(ProblemFieldErrorSchema).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

/* ------------------------------------------------------------ pagination -- */

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/* --------------------------------------------------------------- devices -- */

/** Body for `POST /devices` (register Expo push token, Section 8.3 / 13). */
export const RegisterDeviceSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().optional(),
});
export type RegisterDevice = z.infer<typeof RegisterDeviceSchema>;
