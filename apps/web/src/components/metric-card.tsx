import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@cbs/ui/lib/cn";
import { route } from "@/lib/route";

export type MetricTone =
  | "brand"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "booking";

const toneVar: Record<MetricTone, string> = {
  brand: "var(--color-maroon)",
  neutral: "var(--color-ink-500)",
  success: "var(--color-approved)",
  warning: "var(--color-warning)",
  danger: "var(--color-rejected)",
  info: "var(--color-info)",
  booking: "var(--color-booking)",
};

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon: LucideIcon;
  href?: string;
  tone?: MetricTone;
  className?: string;
  asDefinition?: boolean;
};

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  href,
  tone = "brand",
  className,
  asDefinition = false,
}: MetricCardProps) {
  const style = {
    "--metric-tone": toneVar[tone],
  } as React.CSSProperties & Record<"--metric-tone", string>;

  const labelNode = asDefinition ? (
    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
      {label}
    </dt>
  ) : (
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
      {label}
    </p>
  );

  const valueNode = asDefinition ? (
    <dd className="mt-4 text-4xl font-semibold tabular-nums leading-none text-[var(--color-foreground)]">
      {value}
    </dd>
  ) : (
    <p className="mt-4 text-4xl font-semibold tabular-nums leading-none text-[var(--color-foreground)]">
      {value}
    </p>
  );

  const card = (
    <div
      style={style}
      className={cn(
        "group/metric relative h-full overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--metric-tone)_30%,var(--color-border))] bg-[color-mix(in_oklch,var(--metric-tone)_5%,var(--color-card))] text-[var(--color-card-foreground)] shadow-[0_18px_50px_color-mix(in_oklch,var(--metric-tone)_10%,transparent)] transition-[border-color,box-shadow,transform]",
        href
          ? "hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--metric-tone)_46%,var(--color-border))] hover:shadow-[0_22px_60px_color-mix(in_oklch,var(--metric-tone)_14%,transparent)]"
          : "",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-5 size-28 rotate-6 text-[color-mix(in_oklch,var(--metric-tone)_9%,transparent)] transition-transform group-hover/metric:rotate-3"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-5 left-0 top-5 w-1 rounded-r-full bg-[color-mix(in_oklch,var(--metric-tone)_76%,var(--color-card))]"
      />
      <span
        aria-hidden="true"
        className="absolute left-5 top-0 h-px w-24 bg-[color-mix(in_oklch,var(--metric-tone)_40%,transparent)]"
      />
      <div className="relative flex min-h-36 flex-col justify-between p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {labelNode}
            {valueNode}
          </div>
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklch,var(--metric-tone)_28%,var(--color-border))] bg-[color-mix(in_oklch,var(--metric-tone)_12%,var(--color-card))] text-[color-mix(in_oklch,var(--metric-tone)_76%,var(--color-foreground))] shadow-sm"
          >
            <Icon className="size-5" />
          </span>
        </div>
        {subtext ? (
          <p className="mt-5 max-w-64 text-sm leading-5 text-[var(--color-muted-foreground)]">
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <Link
      href={route(href)}
      className="block h-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ring)]"
    >
      {card}
    </Link>
  );
}
