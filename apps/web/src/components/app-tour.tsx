"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, X } from "lucide-react";
import { Button } from "@cbs/ui/components/button";

type TourStep = {
  selector: string | string[];
  title: string;
  description: string;
};

const TOUR_EVENT = "aura:replay-tour";

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
}

function findTarget(selector: string | string[]): HTMLElement | null {
  const selectors = Array.isArray(selector) ? selector : [selector];
  for (const item of selectors) {
    const candidates = Array.from(document.querySelectorAll(item));
    const visible = candidates.find(isVisible);
    if (visible) return visible;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedData() {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  return connection?.saveData === true;
}

function completionKey(userId: string, mode: "app" | "admin") {
  return `aura-dashboard-tour-complete:${mode}:${userId}`;
}

export function dispatchReplayTour() {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT));
}

export function AppTour({
  userId,
  mode,
  autoStart,
}: {
  userId?: string;
  mode: "app" | "admin";
  autoStart: boolean;
}) {
  const steps = React.useMemo<TourStep[]>(
    () => [
      {
        selector: [
          "[data-tour='desktop-navigation']",
          "[data-tour='mobile-navigation']",
        ],
        title: "Navigation",
        description:
          "Use the sidebar on desktop or the hamburger menu on mobile to move between every AURA workspace.",
      },
      {
        selector: "[data-tour='page-header']",
        title: "Page header",
        description:
          "This area tells you where you are, what the page is for, and opens page-specific help.",
      },
      {
        selector: "[data-tour='primary-actions']",
        title: "Primary action",
        description:
          "When a page has one main next step, it lives here so you do not have to hunt for it.",
      },
      {
        selector: "[data-tour='main-content']",
        title: "Workspace",
        description:
          "This is where the live dashboard data, tables, forms, calendars, and empty states appear.",
      },
      {
        selector: "[data-tour='theme-toggle']",
        title: "Theme",
        description:
          "Switch between light and dark mode from here. AURA saves the preference on this browser.",
      },
      {
        selector: "[data-tour='notifications']",
        title: "Notifications",
        description:
          "Booking decisions, booking updates, and system messages collect here as you work.",
      },
      {
        selector: "[data-tour='user-menu']",
        title: "Account menu",
        description:
          "Open your profile, settings, user guide, replay this tour, or sign out from this menu.",
      },
    ],
    [],
  );
  const [active, setActive] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const current = steps[index];
  const total = steps.length;
  const completeKey = userId ? completionKey(userId, mode) : null;

  const startTour = React.useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const finishTour = React.useCallback(
    (markComplete = true) => {
      setActive(false);
      setRect(null);
      if (markComplete && completeKey) {
        window.localStorage.setItem(completeKey, "true");
      }
    },
    [completeKey],
  );

  React.useEffect(() => {
    function replay() {
      startTour();
    }
    window.addEventListener(TOUR_EVENT, replay);
    return () => window.removeEventListener(TOUR_EVENT, replay);
  }, [startTour]);

  React.useEffect(() => {
    if (!autoStart || !completeKey || prefersReducedData()) return;
    if (window.localStorage.getItem(completeKey) === "true") return;
    const timeout = window.setTimeout(startTour, 650);
    return () => window.clearTimeout(timeout);
  }, [autoStart, completeKey, startTour]);

  React.useEffect(() => {
    if (!active || !current) return;
    const step = current;

    let frame = 0;
    function measure() {
      const target = findTarget(step.selector);
      if (!target) {
        setIndex((value) => Math.min(value + 1, total - 1));
        return;
      }
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      frame = window.requestAnimationFrame(() => {
        setRect(target.getBoundingClientRect());
      });
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current, total]);

  React.useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finishTour();
      if (event.key === "ArrowRight") {
        setIndex((value) => (value >= total - 1 ? value : value + 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((value) => Math.max(0, value - 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, finishTour, total]);

  if (!active || !current || !rect) return null;

  const margin = 10;
  const highlight = {
    top: clamp(rect.top - margin, 8, window.innerHeight),
    left: clamp(rect.left - margin, 8, window.innerWidth),
    width: clamp(rect.width + margin * 2, 48, window.innerWidth - 16),
    height: clamp(rect.height + margin * 2, 48, window.innerHeight - 16),
  };
  const panelWidth = Math.min(360, window.innerWidth - 32);
  const below = highlight.top + highlight.height + 16;
  const placeBelow = below + 220 < window.innerHeight;
  const panelTop = placeBelow
    ? below
    : Math.max(16, highlight.top - 236);
  const panelLeft = clamp(
    highlight.left + highlight.width / 2 - panelWidth / 2,
    16,
    window.innerWidth - panelWidth - 16,
  );

  return (
    <div
      aria-label="AURA dashboard tour"
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[90]"
    >
      <div className="absolute inset-0 bg-[color-mix(in_oklch,var(--color-ink-950)_58%,transparent)]" />
      <div
        aria-hidden="true"
        className="absolute rounded-2xl border-2 border-[var(--color-maroon-tint)] bg-transparent shadow-[0_0_0_9999px_color-mix(in_oklch,var(--color-ink-950)_48%,transparent),0_18px_60px_color-mix(in_oklch,var(--color-maroon)_28%,transparent)]"
        style={highlight}
      />
      <div
        className="absolute rounded-2xl border border-[var(--color-border)] bg-[var(--color-popover)] p-4 text-[var(--color-popover-foreground)] shadow-2xl"
        style={{ width: panelWidth, top: panelTop, left: panelLeft }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-maroon)]">
              Step {index + 1} of {total}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-foreground)]">
              {current.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={() => finishTour()}
            className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
          {current.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          {index === total - 1 ? (
            <Button type="button" size="sm" onClick={() => finishTour()}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Finish
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setIndex((value) => Math.min(total - 1, value + 1))
              }
            >
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => finishTour()}
          className="mt-3 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          Skip and do not auto-show again
        </button>
      </div>
    </div>
  );
}
