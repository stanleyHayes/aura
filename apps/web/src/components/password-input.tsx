"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@cbs/ui/components/input";
import { cn } from "@cbs/ui/lib/cn";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, onKeyDown, onKeyUp, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const [capsLock, setCapsLock] = React.useState(false);

    function updateCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
      setCapsLock(event.getModifierState("CapsLock"));
    }

    return (
      <div className="space-y-1">
        <div className="relative">
          <Input
            ref={ref}
            {...props}
            type={visible ? "text" : "password"}
            className={cn("pr-11", className)}
            onKeyDown={(event) => {
              updateCapsLock(event);
              onKeyDown?.(event);
            }}
            onKeyUp={(event) => {
              updateCapsLock(event);
              onKeyUp?.(event);
            }}
          />
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {capsLock ? (
          <p role="status" className="text-xs text-[color-mix(in_oklch,var(--color-warning)_62%,var(--color-foreground))]">
            Caps Lock is on.
          </p>
        ) : null}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
