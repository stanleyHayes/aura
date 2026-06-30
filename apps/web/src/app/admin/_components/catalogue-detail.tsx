import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  DoorOpen,
  ImageIcon,
  Images,
  Info,
  type LucideIcon as IconType,
} from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import { cn } from "@cbs/ui/lib/cn";
import { IconWatermark } from "@/components/watermark";
import { route } from "@/lib/route";

type DetailTone = "brand" | "success" | "warning" | "info" | "neutral";

const toneVar: Record<DetailTone, string> = {
  brand: "var(--color-maroon)",
  success: "var(--color-approved)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  neutral: "var(--color-muted-foreground)",
};

export type DetailStat = {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon: LucideIcon;
  tone?: DetailTone;
};

export function DetailBackButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={route(href)}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}

function fallbackTitle(icon: IconType, title: string) {
  const Icon = icon;
  return (
    <div className="relative grid h-full min-h-72 place-items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-maroon-tint)_42%,var(--color-card))] text-[var(--color-maroon)]">
      <IconWatermark
        icon={Icon}
        className="-right-8 top-1/2 size-64 -translate-y-1/2 rotate-[-10deg]"
      />
      <div className="relative z-10 grid place-items-center gap-3 text-center">
        <span className="grid size-20 place-items-center rounded-2xl border border-[color-mix(in_oklch,var(--color-maroon)_24%,var(--color-border))] bg-[var(--color-card)] shadow-sm">
          <Icon className="size-9" aria-hidden="true" />
        </span>
        <p className="max-w-56 text-sm font-semibold text-[var(--color-foreground)]">
          {title}
        </p>
      </div>
    </div>
  );
}

export function CatalogueDetailHero({
  icon: Icon = DoorOpen,
  imageUrl,
  galleryUrls = [],
  imageAlt,
  fallbackLabel,
  stats,
  children,
}: {
  icon?: LucideIcon;
  imageUrl?: string | null;
  galleryUrls?: string[];
  imageAlt: string;
  fallbackLabel: string;
  stats: DetailStat[];
  children: React.ReactNode;
}) {
  const gallery = galleryUrls.filter(Boolean).slice(0, 6);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <div className="space-y-3">
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
            <img
              src={imageUrl}
              alt={imageAlt}
              className="aspect-[16/10] max-h-[32rem] w-full object-cover"
            />
          </div>
        ) : (
          fallbackTitle(Icon, fallbackLabel)
        )}
        {gallery.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {gallery.map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={url}
                alt={`${imageAlt} gallery image ${index + 1}`}
                className="aspect-[4/3] rounded-xl border border-[var(--color-border)] object-cover shadow-sm"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
            <Images className="size-4" aria-hidden="true" />
            No gallery images have been added yet.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
          <IconWatermark
            icon={Icon}
            className="-right-8 top-8 size-44 rotate-[-8deg]"
          />
          <div className="relative z-10">{children}</div>
        </div>
        <DetailStatGrid stats={stats} />
      </div>
    </section>
  );
}

export function DetailStatGrid({ stats }: { stats: DetailStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const style = {
          "--detail-tone": toneVar[stat.tone ?? "brand"],
        } as React.CSSProperties & Record<"--detail-tone", string>;
        return (
          <div
            key={stat.label}
            style={style}
            className="relative min-h-32 overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--detail-tone)_28%,var(--color-border))] bg-[color-mix(in_oklch,var(--detail-tone)_6%,var(--color-card))] p-4 shadow-sm"
          >
            <Icon
              className="absolute -right-5 -top-5 size-24 rotate-6 text-[color-mix(in_oklch,var(--detail-tone)_10%,transparent)]"
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {stat.label}
                </p>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--detail-tone)_14%,var(--color-card))] text-[color-mix(in_oklch,var(--detail-tone)_78%,var(--color-foreground))]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </div>
              <div>
                <p className="mt-4 text-3xl font-semibold tabular-nums leading-none text-[var(--color-foreground)]">
                  {stat.value}
                </p>
                {stat.subtext ? (
                  <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                    {stat.subtext}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
          <Info className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DetailFields({
  fields,
}: {
  fields: { label: string; value?: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,var(--color-card))] p-4"
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {field.label}
          </dt>
          <dd className="mt-2 break-words text-sm font-medium text-[var(--color-foreground)]">
            {field.value ?? "-"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyInline({
  icon: Icon = ImageIcon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,var(--color-card))] p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-[var(--color-foreground)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </div>
    </div>
  );
}
