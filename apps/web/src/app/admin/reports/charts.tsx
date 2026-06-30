"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UtilisationRow } from "@cbs/schemas";
import { EmptyState } from "@/components/empty-state";
import { route } from "@/lib/route";

const tickStyle = { fontSize: 12, fill: "var(--color-muted-foreground)" };
const gridStroke = "color-mix(in oklch, var(--color-border) 78%, transparent)";
const tooltipCursor = {
  fill: "color-mix(in oklch, var(--color-maroon-tint) 42%, transparent)",
} as const;
const tooltipContentStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  boxShadow:
    "0 18px 45px color-mix(in oklch, var(--color-ink-950) 24%, transparent)",
  fontSize: 12,
} as const;
const tooltipLabelStyle = {
  color: "var(--color-popover-foreground)",
  fontWeight: 700,
} as const;
const tooltipItemStyle = {
  color: "var(--color-popover-foreground)",
} as const;

/** Truncate long axis labels so the chart stays legible. */
function truncate(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Axis tick that renders a recognizable, clickable room label. Clicking
 * navigates to the room's admin profile.
 */
function RoomAxisTick({
  x,
  y,
  payload,
  rooms,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  rooms: Map<string, { label: string; id: string }>;
}) {
  const router = useRouter();
  const key = payload?.value ?? "";
  const entry = rooms.get(key);
  const label = entry?.label ?? key;
  return (
    <text
      x={(x ?? 0) - 8}
      y={y}
      dy={4}
      textAnchor="end"
      style={{ ...tickStyle, cursor: entry ? "pointer" : "default" }}
      onClick={
        entry
          ? () => router.push(route(`/admin/rooms/${entry.id}`))
          : undefined
      }
    >
      {truncate(label, 18)}
    </text>
  );
}

export function UtilisationChart({
  rows,
  emptyActions,
}: {
  rows: UtilisationRow[];
  emptyActions?: ReactNode;
}) {
  const router = useRouter();
  const data = rows
    .slice()
    .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
    .slice(0, 12)
    .map((r) => ({
      // Recharts keys the axis on `name`; use room_id so labels are unique
      // even when two rooms share a display name.
      name: r.room_id,
      label: r.room_name || r.room_code,
      roomId: r.room_id,
      utilisation: Math.round(r.utilisation_pct),
    }));

  // Map the axis key (room_id) -> a recognizable label + the id to link to.
  const rooms = new Map(
    data.map((d) => [d.name, { label: d.label, id: d.roomId }]),
  );

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No utilisation data for this range"
        description="This chart needs timetable rows or approved bookings inside the selected dates."
        actions={emptyActions}
        className="min-h-80 border-0 bg-transparent py-12 shadow-none"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 42 + 72)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 18, bottom: 8, left: 10 }}
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
          width={148}
          tick={<RoomAxisTick rooms={rooms} />}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          cursor={tooltipCursor}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          labelFormatter={(value) => rooms.get(String(value))?.label ?? value}
          formatter={(value) => [`${value}%`, "Utilisation"]}
        />
        <Bar
          dataKey="utilisation"
          radius={[0, 8, 8, 0]}
          cursor="pointer"
          onClick={(entry) => {
            const roomId = (entry as { payload?: { roomId?: string } })?.payload
              ?.roomId;
            if (roomId) router.push(route(`/admin/rooms/${roomId}`));
          }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill="var(--color-maroon)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Axis tick that renders a recognizable, optionally angled label. */
function LabelTick({
  x,
  y,
  payload,
  labels,
  angled = false,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  labels: Map<string, string>;
  angled?: boolean;
}) {
  const key = payload?.value ?? "";
  const label = labels.get(key) ?? key;
  const anchor = angled ? "end" : "middle";
  const transform =
    angled && x !== undefined && y !== undefined
      ? `rotate(-28 ${x} ${y + 12})`
      : undefined;
  return (
    <text
      x={x}
      y={(y ?? 0) + 14}
      textAnchor={anchor}
      transform={transform}
      style={tickStyle}
    >
      {truncate(label, angled ? 14 : 18)}
    </text>
  );
}

export function BookingsChart({
  data: byKey,
  labels: labelMap = {},
  emptyActions,
}: {
  data: Record<string, number>;
  /** Maps the data key (e.g. a department code) to a recognizable name. */
  labels?: Record<string, string>;
  emptyActions?: ReactNode;
}) {
  const data = Object.entries(byKey)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key, count]) => ({ key, count }));

  // key -> recognizable label, falling back to the raw key when no name maps.
  const labels = new Map(data.map((d) => [d.key, labelMap[d.key] ?? d.key]));
  const angledLabels = data.length > 5;

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No bookings for this range"
        description="Department booking totals appear once approved or requested bookings fall inside the selected dates."
        actions={emptyActions}
        className="min-h-80 border-0 bg-transparent py-12 shadow-none"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{
          top: 8,
          right: 8,
          bottom: angledLabels ? 46 : 8,
          left: -8,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="key"
          tick={<LabelTick labels={labels} angled={angledLabels} />}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={angledLabels ? 74 : 36}
        />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={tooltipCursor}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          labelFormatter={(value) => labels.get(String(value)) ?? value}
          formatter={(value) => [value, "Bookings"]}
        />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-maroon)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
