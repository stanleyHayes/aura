import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)]",
        info: "border-[color-mix(in_oklch,var(--color-info)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-info)_8%,transparent)] text-[var(--color-info)] [&>svg]:text-[var(--color-info)]",
        warning:
          "border-[color-mix(in_oklch,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-warning)_10%,transparent)] text-[var(--color-warning)] [&>svg]:text-[var(--color-warning)]",
        destructive:
          "border-[color-mix(in_oklch,var(--color-destructive)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-destructive)_8%,transparent)] text-[var(--color-destructive)] [&>svg]:text-[var(--color-destructive)]",
        success:
          "border-[color-mix(in_oklch,var(--color-success)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-success)_8%,transparent)] text-[var(--color-success)] [&>svg]:text-[var(--color-success)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
