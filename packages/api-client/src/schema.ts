/**
 * Hand-authored OpenAPI `paths`/`components` types for the CBS API (§8.3).
 *
 * TODO(openapi): The contract source of truth is `/api/openapi.yaml` (§8). That
 * file does not yet exist in this repository, so this module is hand-written to
 * the §8.3 endpoint catalogue to keep the web app fully typed against the wire
 * contract. When the backend publishes `api/openapi.yaml`, regenerate with
 * `pnpm --filter @cbs/api-client run generate` and switch `index.ts` to import
 * from `./schema.gen.ts`. The two must not drift (§19.2 "no contract drift").
 *
 * The shapes deliberately mirror `@cbs/schemas` (zod) field-for-field.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Reusable component shapes (mirror @cbs/schemas/entities) ──────────────
export interface components {
  schemas: {
    Problem: {
      type?: string;
      title: string;
      status: number;
      detail?: string;
      instance?: string;
      code: string;
      errors?: { field: string; message: string }[];
    };
    User: {
      id: string;
      email: string;
      full_name: string;
      role: "SYSTEM_ADMIN" | "TIMETABLE_ADMIN" | "BOOKING_OFFICER" | "REQUESTER";
      status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
      department_id?: string | null;
      department?: components["schemas"]["Department"] | null;
      mfa_enabled: boolean;
      last_login_at?: string | null;
      created_at: string;
      updated_at: string;
    };
    Session: {
      user: components["schemas"]["User"];
      permissions: string[];
    };
    Department: {
      id: string;
      code: string;
      name: string;
      faculty?: string | null;
      created_at: string;
      updated_at: string;
    };
    Building: {
      id: string;
      code: string;
      name: string;
      campus?: string | null;
      image_url?: string | null;
      image_public_id?: string | null;
      gallery_urls: string[];
      gallery_public_ids: string[];
      created_at: string;
      updated_at: string;
    };
    Equipment: {
      id: string;
      code: string;
      name: string;
      image_url?: string | null;
      image_public_id?: string | null;
      gallery_urls: string[];
      gallery_public_ids: string[];
    };
    Room: {
      id: string;
      room_code: string;
      name: string;
      building_id: string;
      building_code?: string | null;
      building_name?: string | null;
      capacity: number;
      room_type:
        | "LECTURE_HALL"
        | "LAB"
        | "SEMINAR_ROOM"
        | "AUDITORIUM"
        | "CONFERENCE_ROOM";
      status: "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE";
      image_url?: string | null;
      image_public_id?: string | null;
      gallery_urls: string[];
      gallery_public_ids: string[];
      equipment: {
        equipment_id: string;
        code: string;
        name: string;
        image_url?: string | null;
        quantity: number;
      }[];
      created_at: string;
      updated_at: string;
    };
    Semester: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      status: "DRAFT" | "ACTIVE" | "ARCHIVED";
      created_at: string;
      updated_at: string;
    };
    TimetableEvent: {
      id: string;
      semester_id: string;
      room_id: string;
      room_code?: string;
      course_code: string;
      course_title: string;
      lecturer_name: string;
      day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
      start_time: string;
      end_time: string;
      created_at: string;
    };
    TimetableImport: {
      id: string;
      semester_id: string;
      uploaded_by: string;
      method: "EXCEL" | "CSV" | "MANUAL";
      status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "PARTIALLY_COMPLETED";
      total_rows: number;
      imported_rows: number;
      error_rows: number;
      error_report?:
        | { row: number; field?: string | null; message: string }[]
        | null;
      created_at: string;
      completed_at?: string | null;
    };
    Booking: {
      id: string;
      room_id: string;
      room?: components["schemas"]["Room"] | null;
      requested_by: string;
      requester?: components["schemas"]["User"] | null;
      purpose: string;
      attendee_count: number;
      starts_at: string;
      ends_at: string;
      status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
      reviewed_by?: string | null;
      reviewer?: components["schemas"]["User"] | null;
      review_note?: string | null;
      reviewed_at?: string | null;
      cancelled_at?: string | null;
      created_at: string;
      updated_at: string;
    };
    BookingApprovability: {
      booking: components["schemas"]["Booking"];
      can_approve: boolean;
      blockers: {
        kind:
          | "LECTURE"
          | "MAINTENANCE"
          | "APPROVED_BOOKING"
          | "COMPETING_PENDING"
          | "CAPACITY"
          | "IN_PAST";
        message: string;
        starts_at?: string | null;
        ends_at?: string | null;
        reference?: string | null;
      }[];
      competing_pending_count: number;
    };
    BookingMetrics: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
    MaintenanceWindow: {
      id: string;
      room_id: string;
      room?: components["schemas"]["Room"] | null;
      starts_at: string;
      ends_at: string;
      reason: string;
      created_by: string;
      created_at: string;
    };
    Notification: {
      id: string;
      user_id: string;
      channel: "EMAIL" | "IN_APP" | "PUSH";
      type: string;
      title: string;
      body: string;
      related_entity_type?: string | null;
      related_entity_id?: string | null;
      read_at?: string | null;
      created_at: string;
    };
    AuditLog: {
      id: string;
      actor_id?: string | null;
      actor_name?: string | null;
      action: string;
      entity_type: string;
      entity_id?: string | null;
      changes?: unknown;
      ip_address?: string | null;
      created_at: string;
    };
    AvailabilityResult: {
      room: components["schemas"]["Room"];
      /** Minutes from midnight: inclusive start, exclusive end. */
      free_intervals: { start: number; end: number }[];
    };
    CalendarBlock: {
      date: string;
      room_id: string;
      source: "LECTURE" | "BOOKING" | "MAINTENANCE" | "AVAILABLE";
      status?: string;
      label: string;
      start: string;
      end: string;
    };
    UtilisationReport: {
      rooms: {
        room_id: string;
        room_code: string;
        room_name: string;
        capacity: number;
        lecture_hours: number;
        booked_hours: number;
        available_hours: number;
        utilisation_pct: number;
      }[];
      total_lecture_hours: number;
      total_booked_hours: number;
      average_utilisation_pct: number;
    };
    BookingReport: {
      by_status: Record<string, number>;
      by_building: Record<string, number>;
      by_department: Record<string, number>;
      approval_rate_pct: number;
      rejection_rate_pct: number;
      total_requests: number;
    };
    ConflictReport: {
      rejected_requests: number;
      cancelled_bookings: number;
      expired_requests: number;
    };
  };
}

type S = components["schemas"];

// Cursor-paginated envelope (§8.1).
type Page<T> = { data: T[]; next_cursor: string | null };

// Helper shorthands for openapi-fetch operation typing.
type JsonGet<R, Q = Record<string, unknown>> = {
  parameters: { query?: Q; path?: Record<string, string> };
  responses: {
    200: { content: { "application/json": R } };
    default: { content: { "application/problem+json": S["Problem"] } };
  };
};
type JsonPost<R, B = unknown> = {
  parameters: { path?: Record<string, string>; query?: Record<string, unknown> };
  requestBody?: { content: { "application/json": B } };
  responses: {
    200: { content: { "application/json": R } };
    201: { content: { "application/json": R } };
    202: { content: { "application/json": R } };
    204: { content: never };
    default: { content: { "application/problem+json": S["Problem"] } };
  };
};
type MultipartPost<R> = {
  parameters: { path?: Record<string, string>; query?: Record<string, unknown> };
  requestBody?: { content: { "multipart/form-data": FormData } };
  responses: {
    200: { content: { "application/json": R } };
    201: { content: { "application/json": R } };
    default: { content: { "application/problem+json": S["Problem"] } };
  };
};

// ── Paths (§8.3) ──────────────────────────────────────────────────────────
export interface paths {
  "/api/v1/auth/login": {
    post: JsonPost<
      S["Session"],
      { email: string; password: string; mfa_code?: string }
    >;
  };
  "/api/v1/auth/refresh": { post: JsonPost<{ ok: true }> };
  "/api/v1/auth/logout": { post: JsonPost<{ ok: true }> };
  "/api/v1/auth/me": {
    get: JsonGet<S["Session"]>;
    patch: JsonPost<
      S["Session"],
      { full_name: string; department_id?: string | null }
    >;
  };
  "/api/v1/auth/password/change": {
    post: JsonPost<
      { ok: true },
      { current_password: string; new_password: string }
    >;
  };
  "/api/v1/auth/password/forgot": {
    post: JsonPost<{ ok: true }, { email: string }>;
  };
  "/api/v1/auth/password/reset": {
    post: JsonPost<{ ok: true }, { token: string; new_password: string }>;
  };
  "/api/v1/auth/mfa/enrol": {
    post: JsonPost<{ provisioning_uri: string; secret: string }>;
  };
  "/api/v1/auth/mfa/verify": { post: JsonPost<{ ok: true }, { code: string }> };

  "/api/v1/users": {
    get: JsonGet<
      Page<S["User"]>,
      { limit?: number; cursor?: string; role?: string; status?: string; q?: string }
    >;
    post: JsonPost<S["User"]>;
  };
  "/api/v1/users/{id}": {
    get: JsonGet<S["User"]>;
    patch: JsonPost<S["User"]>;
  };
  "/api/v1/users/{id}/role": { patch: JsonPost<S["User"], { role: string }> };
  "/api/v1/users/{id}/suspend": { post: JsonPost<S["User"]> };
  "/api/v1/users/{id}/reactivate": { post: JsonPost<S["User"]> };

  "/api/v1/departments": {
    get: JsonGet<Page<S["Department"]>, { limit?: number; cursor?: string }>;
    post: JsonPost<S["Department"]>;
  };
  "/api/v1/departments/{id}": {
    patch: JsonPost<S["Department"]>;
    delete: JsonPost<{ ok: true }>;
  };

  "/api/v1/buildings": {
    get: JsonGet<Page<S["Building"]>, { limit?: number; cursor?: string }>;
    post: JsonPost<S["Building"]>;
  };
  "/api/v1/buildings/{id}": {
    get: JsonGet<S["Building"]>;
    patch: JsonPost<S["Building"]>;
    delete: JsonPost<{ ok: true }>;
  };
  "/api/v1/buildings/{id}/images": { post: MultipartPost<S["Building"]> };

  "/api/v1/equipment": {
    get: JsonGet<Page<S["Equipment"]>, { limit?: number; cursor?: string }>;
    post: JsonPost<S["Equipment"]>;
  };
  "/api/v1/equipment/{id}": {
    get: JsonGet<S["Equipment"]>;
    patch: JsonPost<S["Equipment"]>;
    delete: JsonPost<{ ok: true }>;
  };
  "/api/v1/equipment/{id}/images": { post: MultipartPost<S["Equipment"]> };

  "/api/v1/rooms": {
    get: JsonGet<
      Page<S["Room"]>,
      {
        limit?: number;
        cursor?: string;
        building_id?: string;
        min_capacity?: number;
        room_type?: string;
        equipment?: string;
        status?: string;
        q?: string;
      }
    >;
    post: JsonPost<S["Room"]>;
  };
  "/api/v1/rooms/{id}": {
    get: JsonGet<{
      room: S["Room"];
      equipment: S["Room"]["equipment"] | null;
    }>;
    patch: JsonPost<S["Room"]>;
  };
  "/api/v1/rooms/{id}/deactivate": { post: JsonPost<S["Room"]> };
  "/api/v1/rooms/{id}/images": { post: MultipartPost<S["Room"]> };
  "/api/v1/rooms/{id}/equipment": {
    put: JsonPost<
      S["Room"],
      { items: { equipment_id: string; quantity: number }[] }
    >;
  };

  "/api/v1/semesters": {
    get: JsonGet<Page<S["Semester"]>, { limit?: number; cursor?: string }>;
    post: JsonPost<S["Semester"]>;
  };
  "/api/v1/semesters/{id}": {
    get: JsonGet<S["Semester"]>;
    patch: JsonPost<S["Semester"]>;
  };
  "/api/v1/semesters/{id}/activate": { post: JsonPost<S["Semester"]> };
  "/api/v1/semesters/{id}/archive": { post: JsonPost<S["Semester"]> };
  "/api/v1/semesters/{id}/timetable/import": {
    post: JsonPost<S["TimetableImport"]>;
  };

  "/api/v1/timetable/imports/{id}": { get: JsonGet<S["TimetableImport"]> };
  "/api/v1/timetable/events": {
    get: JsonGet<
      Page<S["TimetableEvent"]>,
      {
        limit?: number;
        cursor?: string;
        semester_id?: string;
        room_id?: string;
        day?: string;
      }
    >;
    post: JsonPost<S["TimetableEvent"]>;
  };
  "/api/v1/timetable/events/{id}": {
    patch: JsonPost<S["TimetableEvent"]>;
    delete: JsonPost<{ ok: true }>;
  };

  "/api/v1/availability/search": {
    get: JsonGet<
      { data: S["AvailabilityResult"][]; next_cursor: string | null },
      {
        date: string;
        start: string;
        end: string;
        building_id?: string;
        min_capacity?: number;
        room_type?: string;
        equipment?: string;
        limit?: number;
        cursor?: string;
      }
    >;
  };

  "/api/v1/bookings": {
    get: JsonGet<
      Page<S["Booking"]>,
      {
        limit?: number;
        cursor?: string;
        scope?: "mine" | "pending" | "all";
        status?: string;
        room_id?: string;
        date?: string;
      }
    >;
    post: JsonPost<S["Booking"]>;
  };
  "/api/v1/bookings/{id}": { get: JsonGet<S["Booking"]> };
  "/api/v1/bookings/metrics": { get: JsonGet<S["BookingMetrics"]> };
  "/api/v1/bookings/{id}/approve": {
    post: JsonPost<S["Booking"], { note?: string }>;
  };
  "/api/v1/bookings/{id}/reject": {
    post: JsonPost<S["Booking"], { note: string }>;
  };
  "/api/v1/bookings/{id}/cancel": { post: JsonPost<S["Booking"]> };
  "/api/v1/bookings/{id}/override": {
    post: JsonPost<S["Booking"], { note: string; cancel_conflicting: boolean }>;
  };

  "/api/v1/calendar": {
    get: JsonGet<
      { view: string; data: S["CalendarBlock"][] },
      {
        view: "day" | "week" | "month";
        date: string;
        room_id?: string;
        building_id?: string;
      }
    >;
  };

  "/api/v1/maintenance-windows": {
    get: JsonGet<
      Page<S["MaintenanceWindow"]>,
      { limit?: number; cursor?: string; room_id?: string }
    >;
    post: JsonPost<S["MaintenanceWindow"]>;
  };
  "/api/v1/maintenance-windows/{id}": { delete: JsonPost<{ ok: true }> };

  "/api/v1/notifications": {
    get: JsonGet<
      Page<S["Notification"]>,
      { limit?: number; cursor?: string; unread?: boolean }
    >;
  };
  "/api/v1/notifications/{id}/read": { post: JsonPost<{ ok: true }> };
  "/api/v1/notifications/read-all": { post: JsonPost<{ ok: true }> };

  "/api/v1/reports/utilisation": {
    get: JsonGet<
      S["UtilisationReport"],
      {
        from: string;
        to: string;
        building_id?: string;
        department_id?: string;
        room_id?: string;
        format?: string;
      }
    >;
  };
  "/api/v1/reports/bookings": {
    get: JsonGet<
      S["BookingReport"],
      { from: string; to: string; building_id?: string; department_id?: string }
    >;
  };
  "/api/v1/reports/conflicts": {
    get: JsonGet<
      S["ConflictReport"],
      { from: string; to: string; building_id?: string }
    >;
  };
  "/api/v1/exports/{id}": {
    get: JsonGet<{ id: string; status: string; download_url?: string | null }>;
  };

  "/api/v1/audit-logs": {
    get: JsonGet<
      Page<S["AuditLog"]>,
      {
        limit?: number;
        cursor?: string;
        entity_type?: string;
        actor_id?: string;
        action?: string;
      }
    >;
  };
}

export type { Page };
