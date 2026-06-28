import { CalendarRange } from "lucide-react";
import { cn } from "@cbs/ui/lib/cn";

/** The Roomwise wordmark + glyph. */
export function Brand({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-[var(--color-ink-700)] text-[var(--color-paper-50)]"
      >
        <CalendarRange className="size-5" />
      </span>
      {withText ? (
        <span className="font-serif text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
          Roomwise
        </span>
      ) : null}
    </span>
  );
}
