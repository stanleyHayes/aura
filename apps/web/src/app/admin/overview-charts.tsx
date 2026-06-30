"use client";

/**
 * Client-side recharts visualisations for the admin overview dashboard.
 *
 * recharts must run in the browser, so this is a `"use client"` module that the
 * server component (admin/page.tsx) imports and feeds already-fetched data to.
 * Styling mirrors the existing reports charts (admin/reports/charts.tsx): axis
 * ticks, gridlines, tooltip surface and radii all flow through AURA design
 * tokens (var(--color-*)). Status colours map to the status tokens; source /
 * lecture / booking tokens are used where those concepts appear.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Clock,
  DoorOpen,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
} from "lucide-react";
import { formatDate } from "@cbs/ui/lib/datetime";
import { EmptyState } from "@/components/empty-state";

export type LabelCount = { label: string; count: number };
export type SeriesPoint = { date: string; submitted: number; approved: number };
export type TopRoom = {
  room_code: string;
  room_name: string;
  utilisation_pct: number;
  booked_hours: number;
};
export type PeakHour = { hour: number; count: number };

const tickStyle = { fontSize: 12, fill: "var(--color-muted-foreground)" };
const gridStroke = "var(--color-border)";
const tooltipContentStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  fontSize: 12,
} as const;
const tooltipCursor = {
  fill: "color-mix(in oklch, var(--color-muted) 60%, transparent)",
} as const;

const emptyClassName = "min-h-72 border-0 bg-transparent py-12 shadow-none";

/**
 * Map a status label (e.g. "PENDING", "approved") to its design token so the
 * donut/bar slices read the same as the StatusBadge colours elsewhere.
 */
function statusColor(label: string): string {
  const key = label.trim().toLowerCase();
  switch (key) {
    case "pending":
      return "var(--color-pending)";
    case "approved":
      return "var(--color-approved)";
    case "rejected":
      return "var(--color-rejected)";
    case "cancelled":
    case "canceled":
      return "var(--color-cancelled)";
    case "expired":
      return "var(--color-expired)";
    default:
      return "var(--color-ink-500)";
  }
}

/** A small fixed palette (design tokens) for categorical breakdowns. */
const CATEGORY_PALETTE = [
  "var(--color-booking)",
  "var(--color-lecture)",
  "var(--color-maintenance)",
  "var(--color-info)",
  "var(--color-maroon)",
  "var(--color-ink-500)",
];

function titleCase(label: string): string {
  return label
    .toLowerCase()
    .replace(/(^|[\s_-])(\w)/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/_/g, " ");
}

/* ── Time-series: submitted vs approved ─────────────────────────────────── */

export function SeriesChart({ series }: { series: SeriesPoint[] }) {
  const data = series.map((p) => ({
    date: p.date,
    label: formatDate(p.date),
    submitted: p.submitted,
    approved: p.approved,
  }));

  if (data.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No activity in this range"
        description="Submitted and approved bookings appear here once requests fall inside the selected dates."
        className={emptyClassName}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <defs>
          <linearGradient id="aura-submitted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="aura-approved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-approved)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-approved)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="label"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip cursor={tooltipCursor} contentStyle={tooltipContentStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          name="Submitted"
          dataKey="submitted"
          stroke="var(--color-info)"
          strokeWidth={2}
          fill="url(#aura-submitted)"
        />
        <Area
          type="monotone"
          name="Approved"
          dataKey="approved"
          stroke="var(--color-approved)"
          strokeWidth={2}
          fill="url(#aura-approved)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Status breakdown: donut ────────────────────────────────────────────── */

export function StatusBreakdownChart({ data: rows }: { data: LabelCount[] }) {
  const data = rows
    .filter((r) => r.count > 0)
    .map((r) => ({ name: titleCase(r.label), value: r.count, raw: r.label }));

  if (data.length === 0) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title="No bookings in this range"
        description="The status split appears once bookings fall inside the selected dates."
        className={emptyClassName}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={96}
          paddingAngle={2}
          stroke="var(--color-card)"
          strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.raw} fill={statusColor(d.raw)} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipContentStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Categorical bar chart (room type / building) ───────────────────────── */

export function CategoryBarChart({
  data: rows,
  emptyTitle,
  emptyDescription,
}: {
  // Note: no icon component is accepted as a prop — passing a Lucide component
  // from the Server Component (admin/page.tsx) across the client boundary throws
  // "Functions cannot be passed to Client Components". The icon is chosen here.
  data: LabelCount[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const data = rows
    .filter((r) => r.count > 0)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((r) => ({ name: titleCase(r.label), count: r.count }));

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={emptyTitle}
        description={emptyDescription}
        className={emptyClassName}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="name"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={data.length > 6 ? -20 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 56 : 30}
        />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip cursor={tooltipCursor} contentStyle={tooltipContentStyle} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Top rooms by utilisation: horizontal bars ──────────────────────────── */

export function TopRoomsChart({ rooms }: { rooms: TopRoom[] }) {
  const data = rooms
    .slice()
    .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
    .slice(0, 10)
    .map((r) => ({
      name: r.room_code,
      utilisation: Math.round(r.utilisation_pct),
    }));

  if (data.length === 0) {
    return (
      <EmptyState
        icon={DoorOpen}
        title="No utilisation data for this range"
        description="Top rooms appear once timetable rows or approved bookings fall inside the selected dates."
        className={emptyClassName}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34 + 40)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          unit="%"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={84}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={tooltipCursor} contentStyle={tooltipContentStyle} />
        <Bar dataKey="utilisation" radius={[0, 4, 4, 0]} fill="var(--color-maroon)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Peak hours: 24-bucket bar chart ────────────────────────────────────── */

export function PeakHoursChart({ hours }: { hours: PeakHour[] }) {
  const byHour = new Map<number, number>();
  for (const h of hours) {
    if (Number.isFinite(h.hour) && h.hour >= 0 && h.hour <= 23) {
      byHour.set(h.hour, (byHour.get(h.hour) ?? 0) + h.count);
    }
  }

  const hasData = Array.from(byHour.values()).some((c) => c > 0);
  if (!hasData) {
    return (
      <EmptyState
        icon={Clock}
        title="No peak-hour data for this range"
        description="Hourly demand appears once bookings fall inside the selected dates."
        className={emptyClassName}
      />
    );
  }

  // Always render the full 0–23 day so gaps read as quiet hours.
  const data = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    count: byHour.get(hour) ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="label"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip cursor={tooltipCursor} contentStyle={tooltipContentStyle} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-booking)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
