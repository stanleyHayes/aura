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
        pending:
          "border-transparent bg-[color-mix(in_oklch,var(--color-pending)_18%,transparent)] text-[var(--color-pending)]",
        approved:
          "border-transparent bg-[color-mix(in_oklch,var(--color-approved)_18%,transparent)] text-[var(--color-approved)]",
        rejected:
          "border-transparent bg-[color-mix(in_oklch,var(--color-rejected)_18%,transparent)] text-[var(--color-rejected)]",
        cancelled:
          "border-transparent bg-[color-mix(in_oklch,var(--color-cancelled)_18%,transparent)] text-[var(--color-cancelled)]",
        expired:
          "border-transparent bg-[color-mix(in_oklch,var(--color-expired)_18%,transparent)] text-[var(--color-expired)]",
        lecture:
          "border-transparent bg-[color-mix(in_oklch,var(--color-lecture)_16%,transparent)] text-[var(--color-lecture)]",
        maintenance:
          "border-transparent bg-[color-mix(in_oklch,var(--color-maintenance)_18%,transparent)] text-[var(--color-maintenance)]",
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
