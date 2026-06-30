"use client";

import * as React from "react";
import { HelpCircle, Square, Volume2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";

/**
 * Auth-screen header (DESIGN.md §2 + §12): a page icon, title, description and a
 * help popover with a short "how to" walk-through. The icon is passed as a
 * rendered element so a Server Component page can supply a lucide icon without
 * tripping the Server→Client function-prop boundary.
 */
export function AuthHeader({
  icon,
  title,
  description,
  help,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  help?: { title?: string; steps: string[] };
}) {
  const [speaking, setSpeaking] = React.useState(false);
  const guideText = React.useMemo(() => {
    if (!help) return "";
    return [title, description, ...(help.steps ?? [])].join(". ");
  }, [description, help, title]);

  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function playGuide() {
    if (!guideText || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(guideText);
    utterance.lang = "en-GB";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopGuide() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]"
      >
        {icon}
      </span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
        {help ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="How this works"
                className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
              >
                <HelpCircle className="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
                {help.title ?? "How this works"}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-[var(--color-muted-foreground)]">
                {help.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <button
                  type="button"
                  onClick={speaking ? stopGuide : playGuide}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-maroon)]"
                >
                  {speaking ? (
                    <>
                      <Square className="size-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-4" />
                      Listen
                    </>
                  )}
                </button>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  Spoken guide
                </span>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
