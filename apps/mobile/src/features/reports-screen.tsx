/**
 * Reports screen (parity with the web admin reports, Section 7.9). Mirrors the
 * same metrics the web shows:
 *  - an overview KPI row (total requests, approval rate, rooms with data,
 *    average utilisation),
 *  - a per-room UTILISATION bar list (recognisable room NAMES),
 *  - a per-department BOOKINGS bar list (department codes; see note below),
 *  - a compact utilisation table.
 *
 * Charts on React Native: rather than pull in a heavy chart dependency we render
 * simple horizontal bar rows — a <View> whose width is proportional to the value
 * — which is the pragmatic RN equivalent of the web's recharts bar chart.
 *
 * DATA LIMITATIONS (see REPORT):
 *  - The mobile OpenAPI surface (`src/api/openapi-types.ts`) does NOT yet declare
 *    the `/reports/*` paths, so they cannot go through the generated
 *    `openapi-fetch` client without type errors. We therefore call the SAME
 *    endpoints the web uses (`/reports/utilisation`, `/reports/bookings`) via a
 *    small authenticated `fetch` helper that reuses the app's bearer token and
 *    base URL (`getApiBaseUrl`, which already includes `/api/v1`). Responses are
 *    validated with locally-declared Zod schemas mirroring the shared report
 *    DTOs (the mobile `@/schemas` barrel does not yet copy the reporting types).
 *  - There is no `/departments` endpoint on mobile, so department booking totals
 *    are keyed by department CODE; we render the code as-is (the web maps
 *    code→name via `/departments`). Room utilisation already carries
 *    `room_name`, so rooms show recognisable names with no extra lookup.
 *  - There is no room-detail route in the mobile app, so room rows are not
 *    tappable (the web links each bar to `/admin/rooms/{id}`).
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { getApiBaseUrl } from '@/api/client';
import { ApiError, messageFromError, toApiError } from '@/api/errors';
import { Card, LoadingScreen, ScreenMessage } from '@/components/ui';
import { getAccessToken } from '@/lib/secure-store';
import { useThemeColors } from '@/theme/theme-context';

/* --------------------------------------------------------- report schemas */
/* Mirrors the canonical DTOs in `/packages/schemas` (UtilisationReport /
 * BookingReport). The mobile `@/schemas` barrel is a self-contained copy that
 * does not yet include the reporting payloads, so they are declared here. */

const UtilisationRowSchema = z.object({
  room_id: z.string(),
  room_code: z.string(),
  room_name: z.string(),
  capacity: z.number().int(),
  lecture_hours: z.number(),
  booked_hours: z.number(),
  available_hours: z.number(),
  utilisation_pct: z.number(),
});
type UtilisationRow = z.infer<typeof UtilisationRowSchema>;

const UtilisationReportSchema = z.object({
  rooms: z.array(UtilisationRowSchema),
  total_lecture_hours: z.number(),
  total_booked_hours: z.number(),
  average_utilisation_pct: z.number(),
});
type UtilisationReport = z.infer<typeof UtilisationReportSchema>;

const BookingReportSchema = z.object({
  by_status: z.record(z.string(), z.number().int()),
  by_building: z.record(z.string(), z.number().int()),
  by_department: z.record(z.string(), z.number().int()),
  approval_rate_pct: z.number(),
  rejection_rate_pct: z.number(),
  total_requests: z.number().int(),
});
type BookingReport = z.infer<typeof BookingReportSchema>;

/* ------------------------------------------------------------------- dates */

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------- report fetch */

/**
 * Authenticated GET against a report endpoint. The generated `openapi-fetch`
 * client is typed to `paths`, which does not yet include `/reports/*`, so we
 * issue the request directly while reusing the app's bearer token + base URL
 * (the same `X-Auth-Mode: bearer` contract as `src/api/client.ts`). The JSON is
 * validated with the supplied Zod schema before it reaches the UI.
 */
async function fetchReport<T>(
  path: string,
  query: Record<string, string>,
  parse: (raw: unknown) => T,
): Promise<T> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${getApiBaseUrl()}${path}?${qs}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Mode': 'bearer',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw toApiError(res.status, body);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('Malformed response from the reports service.', 500);
  }
  return parse(json);
}

/* -------------------------------------------------------------------- bars */

/** Largest value in a list, floored at 1 so a single non-zero bar still shows. */
function maxValue(values: number[]): number {
  return Math.max(1, ...values);
}

function BarRow({
  label,
  sublabel,
  value,
  valueText,
  fraction,
  color,
  track,
}: Readonly<{
  label: string;
  sublabel?: string;
  value: number;
  valueText: string;
  /** 0..1 share of the row's max, drives the bar width. */
  fraction: number;
  color: string;
  track: string;
}>) {
  const pct = Math.max(0.02, Math.min(1, fraction));
  return (
    <View className="gap-1.5 py-2">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-sm font-medium text-foreground"
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text className="text-xs text-muted" numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <Text className="text-sm font-semibold tabular-nums text-foreground">
          {valueText}
        </Text>
      </View>
      <View
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
      >
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ now: value }}
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 9999,
          }}
        />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- KPIs */

function Kpi({
  label,
  value,
  hint,
}: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <Card className="min-w-[46%] flex-1 gap-0.5">
      <Text className="text-2xl font-bold tabular-nums text-foreground">
        {value}
      </Text>
      <Text className="text-xs font-medium text-foreground">{label}</Text>
      {hint ? <Text className="text-[11px] text-muted">{hint}</Text> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ screen */

export function ReportsScreen() {
  const colors = useThemeColors();

  // Match the web default: a trailing 30-day window.
  const filter = useMemo(() => ({ from: isoDaysAgo(30), to: isoDaysAgo(0) }), []);

  const utilisation = useQuery({
    queryKey: ['reports', 'utilisation', filter] as const,
    queryFn: (): Promise<UtilisationReport> =>
      fetchReport('/reports/utilisation', filter, (raw) =>
        UtilisationReportSchema.parse(raw),
      ),
  });

  const bookings = useQuery({
    queryKey: ['reports', 'bookings', filter] as const,
    queryFn: (): Promise<BookingReport> =>
      fetchReport('/reports/bookings', filter, (raw) =>
        BookingReportSchema.parse(raw),
      ),
  });

  if (utilisation.isLoading || bookings.isLoading) {
    return <LoadingScreen label="Loading reports…" />;
  }

  // If both fail, the screen has nothing to show — surface a single error.
  if (utilisation.isError && bookings.isError) {
    return (
      <ScreenMessage
        title="Could not load reports"
        message={messageFromError(utilisation.error ?? bookings.error)}
      />
    );
  }

  const rooms: UtilisationRow[] = utilisation.data?.rooms ?? [];
  const topRooms = [...rooms]
    .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
    .slice(0, 12);
  const roomMax = maxValue(topRooms.map((r) => r.utilisation_pct));

  const byDepartment = bookings.data?.by_department ?? {};
  const departments = Object.entries(byDepartment)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const deptMax = maxValue(departments.map(([, n]) => n));

  const totalRequests = bookings.data?.total_requests ?? 0;
  const approvalRate = bookings.data?.approval_rate_pct ?? 0;
  const avgUtil = utilisation.data?.average_utilisation_pct ?? 0;
  const roomsWithData = rooms.filter(
    (r) => r.booked_hours > 0 || r.lecture_hours > 0,
  ).length;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4"
    >
      {/* Overview KPIs (mirrors the web overview / bookings summary). */}
      <View className="gap-2">
        <Text className="text-xs font-medium uppercase text-muted">
          Overview · last 30 days
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <Kpi
            label="Total requests"
            value={String(totalRequests)}
            hint="Submitted in range"
          />
          <Kpi
            label="Approval rate"
            value={`${Math.round(approvalRate)}%`}
            hint="Approved share"
          />
          <Kpi
            label="Avg utilisation"
            value={`${Math.round(avgUtil)}%`}
            hint="Across rooms"
          />
          <Kpi
            label="Rooms with data"
            value={String(roomsWithData)}
            hint={`of ${rooms.length} rooms`}
          />
        </View>
      </View>

      {/* Per-room utilisation bar list (recognisable room names). */}
      <Card className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted">
          Room utilisation
        </Text>
        {utilisation.isError ? (
          <Text className="py-6 text-center text-sm text-muted">
            {messageFromError(utilisation.error)}
          </Text>
        ) : topRooms.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted">
            No utilisation data for this range. Timetable rows or approved
            bookings inside the dates will populate this.
          </Text>
        ) : (
          <View className="divide-y divide-border">
            {topRooms.map((room) => (
              <BarRow
                key={room.room_id}
                label={room.room_name || room.room_code}
                sublabel={room.room_code}
                value={Math.round(room.utilisation_pct)}
                valueText={`${Math.round(room.utilisation_pct)}%`}
                fraction={room.utilisation_pct / roomMax}
                color={colors.primary}
                track={colors.muted}
              />
            ))}
          </View>
        )}
      </Card>

      {/* Per-department bookings bar list. */}
      <Card className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted">
          Bookings by department
        </Text>
        {bookings.isError ? (
          <Text className="py-6 text-center text-sm text-muted">
            {messageFromError(bookings.error)}
          </Text>
        ) : departments.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted">
            No department bookings for this range.
          </Text>
        ) : (
          <View className="divide-y divide-border">
            {departments.map(([code, count]) => (
              <BarRow
                key={code}
                label={code}
                value={count}
                valueText={String(count)}
                fraction={count / deptMax}
                color={colors.success}
                track={colors.muted}
              />
            ))}
          </View>
        )}
      </Card>

      {/* Compact utilisation table (parity with the web table). */}
      {topRooms.length > 0 ? (
        <Card className="gap-2">
          <Text className="text-xs font-medium uppercase text-muted">
            Utilisation detail
          </Text>
          <View className="flex-row border-b border-border pb-2">
            <Text className="flex-1 text-xs font-semibold text-muted">Room</Text>
            <Text className="w-14 text-right text-xs font-semibold text-muted">
              Cap.
            </Text>
            <Text className="w-16 text-right text-xs font-semibold text-muted">
              Booked
            </Text>
            <Text className="w-12 text-right text-xs font-semibold text-muted">
              Util.
            </Text>
          </View>
          {topRooms.map((room) => (
            <View
              key={room.room_id}
              className="flex-row items-center border-b border-border py-2"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {room.room_name || room.room_code}
                </Text>
                <Text className="text-[11px] text-muted">{room.room_code}</Text>
              </View>
              <Text className="w-14 text-right text-sm tabular-nums text-foreground">
                {room.capacity}
              </Text>
              <Text className="w-16 text-right text-sm tabular-nums text-foreground">
                {room.booked_hours.toFixed(1)}
              </Text>
              <Text className="w-12 text-right text-sm tabular-nums text-foreground">
                {Math.round(room.utilisation_pct)}%
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
