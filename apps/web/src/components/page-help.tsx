"use client";

import * as React from "react";
import { HelpCircle, Square, Volume2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cbs/ui/components/popover";

export function PageHelp({
  title = "How this works",
  pageTitle,
  description,
  steps,
}: {
  title?: string;
  pageTitle: string;
  description?: string;
  steps: string[];
}) {
  const [speaking, setSpeaking] = React.useState(false);
  const transcriptId = React.useId();
  const guideText = React.useMemo(
    () => [pageTitle, description, ...steps].filter(Boolean).join(". "),
    [description, pageTitle, steps],
  );

  React.useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function playGuide() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(guideText);
    utterance.lang = "en-GB";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopGuide() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  return (
    <>
      <div id={transcriptId} data-page-guide hidden>
        <p>{pageTitle}</p>
        {description ? <p>{description}</p> : null}
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Guide for ${pageTitle}`}
            aria-describedby={transcriptId}
            className="mt-1 grid size-10 shrink-0 place-items-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-maroon)]"
          >
            <HelpCircle className="size-7" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted-foreground)]">
              {description}
            </p>
          ) : null}
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {steps.map((step) => (
              <li key={step}>{step}</li>
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
                  <Square className="size-4" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Volume2 className="size-4" aria-hidden="true" />
                  Listen
                </>
              )}
            </button>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Current page guide
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
