import { z } from "zod";
import {
  DayOfWeek,
  ImportMethod,
  RoomStatus,
  RoomType,
  SemesterStatus,
  UserRole,
} from "./enums";
import { DateKey, TimeOfDay, Uuid } from "./entities";

/**
 * Form/request schemas with British-English validation messages (§10.1).
 * These power react-hook-form + @hookform/resolvers and double as the
 * request body contract for the typed client.
 */

export const LoginForm = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  mfa_code: z
    .string()
    .regex(/^\d{6}$/, "The authentication code must be six digits.")
    .optional()
    .or(z.literal("")),
});
export type LoginForm = z.infer<typeof LoginForm>;

export const ForgotPasswordForm = z.object({
  email: z.string().email("Enter a valid email address."),
});
export type ForgotPasswordForm = z.infer<typeof ForgotPasswordForm>;

export const ResetPasswordForm = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128, "That password is too long."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The passwords do not match.",
    path: ["confirm"],
  });
export type ResetPasswordForm = z.infer<typeof ResetPasswordForm>;

export const ProfileForm = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Keep your name under 120 characters."),
  department_id: Uuid.optional().or(z.literal("")),
});
export type ProfileForm = z.infer<typeof ProfileForm>;

export const ChangePasswordForm = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128, "That password is too long."),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    message: "The passwords do not match.",
    path: ["confirm"],
  });
export type ChangePasswordForm = z.infer<typeof ChangePasswordForm>;

/** Availability search (§7.1, FR6). */
export const AvailabilitySearchForm = z
  .object({
    date: DateKey,
    start: TimeOfDay,
    end: TimeOfDay,
    building_id: Uuid.optional().or(z.literal("")),
    min_capacity: z
      .number()
      .int()
      .min(1, "Capacity must be at least one.")
      .optional(),
    room_type: RoomType.optional().or(z.literal("")),
    equipment: z.array(z.string().min(1)).optional(),
  })
  .refine((v) => v.end > v.start, {
    message: "The end time must be after the start time.",
    path: ["end"],
  });
export type AvailabilitySearchForm = z.infer<typeof AvailabilitySearchForm>;

/** Booking submission (§7.2, FR7). */
export const CreateBookingForm = z
  .object({
    room_id: Uuid,
    date: DateKey,
    start: TimeOfDay,
    end: TimeOfDay,
    purpose: z
      .string()
      .min(3, "Describe the purpose in a few words.")
      .max(500, "Keep the purpose under 500 characters."),
    attendee_count: z
      .number()
      .int()
      .min(1, "There must be at least one attendee."),
  })
  .refine((v) => v.end > v.start, {
    message: "The end time must be after the start time.",
    path: ["end"],
  });
export type CreateBookingForm = z.infer<typeof CreateBookingForm>;

export const ReviewBookingForm = z.object({
  note: z.string().max(500).optional(),
});
export type ReviewBookingForm = z.infer<typeof ReviewBookingForm>;

export const RejectBookingForm = z.object({
  note: z
    .string()
    .min(3, "Give a reason for rejecting this request.")
    .max(500, "Keep the note under 500 characters."),
});
export type RejectBookingForm = z.infer<typeof RejectBookingForm>;

export const OverrideBookingForm = z.object({
  note: z.string().min(3, "Record why you are overriding.").max(500),
  cancel_conflicting: z.boolean(),
});
export type OverrideBookingForm = z.infer<typeof OverrideBookingForm>;

/** Admin: room create/edit (§6.4, FR2). */
export const RoomForm = z.object({
  room_code: z.string().min(1, "A room code is required."),
  name: z.string().min(1, "A room name is required."),
  building_id: Uuid,
  capacity: z.number().int().min(1, "Capacity must be at least one."),
  room_type: RoomType,
  status: RoomStatus,
});
export type RoomForm = z.infer<typeof RoomForm>;

export const RoomEquipmentForm = z.object({
  items: z.array(
    z.object({
      equipment_id: Uuid,
      quantity: z.number().int().min(1),
    }),
  ),
});
export type RoomEquipmentForm = z.infer<typeof RoomEquipmentForm>;

export const BuildingForm = z.object({
  code: z.string().min(1, "A building code is required."),
  name: z.string().min(1, "A building name is required."),
  campus: z.string().optional(),
});
export type BuildingForm = z.infer<typeof BuildingForm>;

export const EquipmentForm = z.object({
  code: z.string().min(1, "An equipment code is required."),
  name: z.string().min(1, "An equipment name is required."),
});
export type EquipmentForm = z.infer<typeof EquipmentForm>;

export const DepartmentForm = z.object({
  code: z.string().min(1, "A department code is required."),
  name: z.string().min(1, "A department name is required."),
  faculty: z.string().optional(),
});
export type DepartmentForm = z.infer<typeof DepartmentForm>;

/** Admin: user management (§3.1, FR1). */
export const UserForm = z.object({
  full_name: z.string().min(1, "A full name is required."),
  email: z.string().email("Enter a valid email address."),
  role: UserRole,
  department_id: Uuid.optional().or(z.literal("")),
});
export type UserForm = z.infer<typeof UserForm>;

export const ChangeRoleForm = z.object({ role: UserRole });
export type ChangeRoleForm = z.infer<typeof ChangeRoleForm>;

/** Admin: semester management (§6.5, FR3). */
export const SemesterForm = z
  .object({
    name: z.string().min(1, "A semester name is required."),
    start_date: DateKey,
    end_date: DateKey,
    status: SemesterStatus,
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "The end date must be after the start date.",
    path: ["end_date"],
  });
export type SemesterForm = z.infer<typeof SemesterForm>;

/** Admin: manual timetable event (§7.5). */
export const TimetableEventForm = z
  .object({
    semester_id: Uuid,
    room_id: Uuid,
    course_code: z.string().min(1, "A course code is required."),
    course_title: z.string().min(1, "A course title is required."),
    lecturer_name: z.string().min(1, "A lecturer name is required."),
    day: DayOfWeek,
    start_time: TimeOfDay,
    end_time: TimeOfDay,
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "The end time must be after the start time.",
    path: ["end_time"],
  });
export type TimetableEventForm = z.infer<typeof TimetableEventForm>;

export const TimetableImportForm = z.object({
  mode: z.enum(["replace", "append"]),
  method: ImportMethod,
});
export type TimetableImportForm = z.infer<typeof TimetableImportForm>;

/** Admin: maintenance window (§6.6). */
export const MaintenanceWindowForm = z
  .object({
    room_id: Uuid,
    date: DateKey,
    start: TimeOfDay,
    end: TimeOfDay,
    reason: z.string().min(3, "Give a reason for the maintenance window."),
  })
  .refine((v) => v.end > v.start, {
    message: "The end time must be after the start time.",
    path: ["end"],
  });
export type MaintenanceWindowForm = z.infer<typeof MaintenanceWindowForm>;

/** Reports filter (§7.9). */
export const ReportFilterForm = z.object({
  from: DateKey,
  to: DateKey,
  building_id: Uuid.optional().or(z.literal("")),
  department_id: Uuid.optional().or(z.literal("")),
  room_id: Uuid.optional().or(z.literal("")),
});
export type ReportFilterForm = z.infer<typeof ReportFilterForm>;
