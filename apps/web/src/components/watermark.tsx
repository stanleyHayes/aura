import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@cbs/ui/lib/cn";
import { AuraLogo } from "@/components/aura-logo";

const toneClass = {
  surface:
    "text-[color-mix(in_oklch,var(--color-maroon)_7%,transparent)] dark:text-[color-mix(in_oklch,var(--color-maroon-tint)_7%,transparent)]",
  brand: "text-[color-mix(in_oklch,var(--color-paper-50)_12%,transparent)]",
};

type WatermarkTone = keyof typeof toneClass;

export function IconWatermark({
  icon: Icon,
  tone = "surface",
  className,
}: {
  icon: LucideIcon;
  tone?: WatermarkTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute select-none",
        toneClass[tone],
        className,
      )}
    >
      <Icon className="size-full stroke-[1.15]" />
    </span>
  );
}

export function AuraWatermark({
  tone = "surface",
  className,
}: {
  tone?: WatermarkTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute select-none",
        toneClass[tone],
        className,
      )}
    >
      <AuraLogo className="size-full" />
    </span>
  );
}

const constellationSlots = [
  "left-4 top-5 size-20 rotate-[-10deg]",
  "right-10 top-8 size-24 rotate-6",
  "bottom-7 left-[18%] size-16 rotate-12",
  "bottom-4 right-[24%] size-20 rotate-[-8deg]",
  "left-[46%] top-1/2 size-14 rotate-[14deg]",
];

export function WatermarkConstellation({
  icons,
  tone = "surface",
  includeAura = true,
  className,
}: {
  icons: LucideIcon[];
  tone?: WatermarkTone;
  includeAura?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 select-none overflow-hidden",
        className,
      )}
    >
      {includeAura ? (
        <AuraWatermark
          tone={tone}
          className="bottom-[-4rem] right-[-2rem] size-48 rotate-[-8deg]"
        />
      ) : null}
      {icons.slice(0, constellationSlots.length).map((Icon, index) => (
        <IconWatermark
          key={`${Icon.displayName ?? Icon.name}-${index}`}
          icon={Icon}
          tone={tone}
          className={constellationSlots[index]}
        />
      ))}
    </span>
  );
}
