/** Centralised React Query key factory for cache coherence (§10.1). */
export const qk = {
  session: ["session"] as const,
  rooms: (params?: Record<string, unknown>) => ["rooms", params ?? {}] as const,
  room: (id: string) => ["room", id] as const,
  buildings: ["buildings"] as const,
  building: (id: string) => ["building", id] as const,
  equipment: ["equipment"] as const,
  equipmentItem: (id: string) => ["equipment", id] as const,
  departments: ["departments"] as const,
  users: (params?: Record<string, unknown>) => ["users", params ?? {}] as const,
  semesters: ["semesters"] as const,
  timetableEvents: (params?: Record<string, unknown>) =>
    ["timetable-events", params ?? {}] as const,
  timetableImport: (id: string) => ["timetable-import", id] as const,
  availability: (params: Record<string, unknown>) =>
    ["availability", params] as const,
  bookings: (params?: Record<string, unknown>) =>
    ["bookings", params ?? {}] as const,
  bookingMetrics: ["bookings", "metrics"] as const,
  booking: (id: string) => ["booking", id] as const,
  approvals: (params?: Record<string, unknown>) =>
    ["approvals", params ?? {}] as const,
  calendar: (params: Record<string, unknown>) => ["calendar", params] as const,
  maintenance: (params?: Record<string, unknown>) =>
    ["maintenance", params ?? {}] as const,
  notifications: (params?: Record<string, unknown>) =>
    ["notifications", params ?? {}] as const,
  reportUtilisation: (params: Record<string, unknown>) =>
    ["report-utilisation", params] as const,
  reportBookings: (params: Record<string, unknown>) =>
    ["report-bookings", params] as const,
  reportConflicts: (params: Record<string, unknown>) =>
    ["report-conflicts", params] as const,
  auditLogs: (params?: Record<string, unknown>) =>
    ["audit-logs", params ?? {}] as const,
};
