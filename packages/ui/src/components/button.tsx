import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 shadow-sm",
        destructive:
          "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90 shadow-sm",
        outline:
          "border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]",
        secondary:
          "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:opacity-90",
        ghost:
          "hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]",
        link: "text-[var(--color-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "aura-button-shape h-10 px-7 py-2",
        sm: "aura-button-shape h-9 px-6 text-sm",
        lg: "aura-button-shape h-12 px-10 text-base",
        icon: "size-10 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Async loading state (DESIGN.md §6). Replaces the label with three dots
   * animating in a wave (foreground colour), keeps width stable, disables the
   * button and sets `aria-busy`. Pass `loadingLabel` so AT announces progress.
   * Ignored when `asChild` (the child controls its own content).
   */
  loading?: boolean;
  loadingLabel?: string;
}

/** Three-dot wave loader shown inside a button while it is busy (§6). */
function ButtonWave({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label ?? "Loading"}</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current motion-safe:animate-[button-wave_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingLabel,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const showWave = loading && !asChild;
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={!asChild ? disabled || loading : undefined}
        aria-busy={showWave || undefined}
        {...props}
      >
        {showWave ? (
          <>
            {/* Keep width stable by rendering the label invisibly behind the wave. */}
            <span className="invisible inline-flex items-center gap-2">
              {children}
            </span>
            <span className="absolute inline-flex">
              <ButtonWave label={loadingLabel} />
            </span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
