import { cn } from "@cbs/ui/lib/cn";
import { AuraLogo } from "@/components/aura-logo";

/** The AURA wordmark + mark (BRAND.md). Maroon mark, Outfit 600/700 wordmark. */
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
        className="grid size-8 place-items-center rounded-lg bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
      >
        <AuraLogo className="size-5" />
      </span>
      {withText ? (
        <span className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
          AURA
        </span>
      ) : null}
    </span>
  );
}
