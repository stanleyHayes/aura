import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
        secondary:
          "border-transparent bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
        outline: "text-[var(--color-foreground)]",
        // Booking workflow states (§7.2) — also used by status badges.
        // Status tints: composite the hue over the adaptive --color-card and blend
        // the label toward the adaptive --color-foreground so BOTH surface and text
        // flip with the theme. Using fixed status tokens for text (the old pattern)
        // collapsed to ~2-3:1 in dark mode. Verified ≥4.5:1 (AA body) in both themes.
        pending:
          "border-transparent bg-[color-mix(in_oklch,var(--color-pending)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-pending)_72%,var(--color-foreground))]",
        approved:
          "border-transparent bg-[color-mix(in_oklch,var(--color-approved)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-approved)_55%,var(--color-foreground))]",
        rejected:
          "border-transparent bg-[color-mix(in_oklch,var(--color-rejected)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-rejected)_55%,var(--color-foreground))]",
        cancelled:
          "border-transparent bg-[color-mix(in_oklch,var(--color-cancelled)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-cancelled)_55%,var(--color-foreground))]",
        expired:
          "border-transparent bg-[color-mix(in_oklch,var(--color-expired)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-expired)_62%,var(--color-foreground))]",
        lecture:
          "border-transparent bg-[color-mix(in_oklch,var(--color-lecture)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-lecture)_60%,var(--color-foreground))]",
        maintenance:
          "border-transparent bg-[color-mix(in_oklch,var(--color-maintenance)_18%,var(--color-card))] text-[color-mix(in_oklch,var(--color-maintenance)_62%,var(--color-foreground))]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
