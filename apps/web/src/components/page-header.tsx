import * as React from "react";
import { LayoutDashboard, type LucideIcon } from "lucide-react";
import { PageHelp } from "@/components/page-help";
import { IconWatermark } from "@/components/watermark";
import { getPageGuide } from "@/lib/page-guides";

/**
 * Standard page header (DESIGN.md §2): a large maroon-tinted page icon, title
 * with a guide trigger, a one-line description, and right-aligned actions.
 * The icon is decorative (`aria-hidden`); the title carries the meaning.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  help,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  help?: React.ReactNode;
}) {
  const HeaderIcon = Icon ?? LayoutDashboard;
  const defaultGuide = getPageGuide({ title, description });
  const guide =
    help === undefined ? (
      <PageHelp
        title={`How to use ${defaultGuide.title}`}
        pageTitle={defaultGuide.title}
        description={defaultGuide.description}
        steps={defaultGuide.steps}
      />
    ) : (
      help
    );

  return (
    <div
      data-tour="page-header"
      className="relative mb-7 flex flex-col gap-5 border-b border-[var(--color-border)] pb-6 lg:flex-row lg:items-center lg:justify-between"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden lg:block"
      >
        <IconWatermark
          icon={HeaderIcon}
          className="-right-8 top-1/2 size-52 -translate-y-1/2 rotate-[-8deg]"
        />
      </span>
      <div className="relative z-10 flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)] sm:size-16"
        >
          <HeaderIcon className="size-7" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-foreground)] sm:text-4xl">
              {title}
            </h1>
            {guide}
          </div>
          {description ? (
            <p
              data-page-description
              className="mt-2 max-w-3xl text-base leading-7 text-[var(--color-muted-foreground)]"
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div
          data-tour="primary-actions"
          className="relative z-10 flex w-full shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto [&_.aura-button-shape]:h-12 [&_.aura-button-shape]:justify-center [&_.aura-button-shape]:px-8 [&_.aura-button-shape]:text-base [&_a]:w-full [&_a]:justify-center sm:[&_a]:w-auto [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
