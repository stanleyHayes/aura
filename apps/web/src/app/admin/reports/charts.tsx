"use client";

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

const tickStyle = { fontSize: 12, fill: "var(--color-muted-foreground)" };

export function UtilisationChart({ rows }: { rows: UtilisationRow[] }) {
  const data = rows
    .slice()
    .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
    .slice(0, 12)
    .map((r) => ({
      name: r.room_code,
      utilisation: Math.round(r.utilisation_pct),
    }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No utilisation data for this range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
        <YAxis unit="%" tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "color-mix(in oklch, var(--color-muted) 60%, transparent)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-popover)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="utilisation" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill="var(--color-ink-600)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BookingsChart({
  data: byKey,
}: {
  data: Record<string, number>;
}) {
  const data = Object.entries(byKey)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No bookings for this range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "color-mix(in oklch, var(--color-muted) 60%, transparent)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-popover)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-booking)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
