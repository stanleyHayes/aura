"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyThemeMode,
  readSavedThemeMode,
  THEME_STORAGE_KEY,
} from "@/lib/theme-preferences";

export function ThemeToggle() {
  const [dark, setDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return readSavedThemeMode() === "dark";
  });

  React.useEffect(() => {
    applyThemeMode(dark ? "dark" : "light");
  }, [dark]);

  function applyTheme(nextDark: boolean) {
    const mode = nextDark ? "dark" : "light";
    applyThemeMode(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    window.dispatchEvent(new Event("aura-theme-change"));
    setDark(nextDark);
  }

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const nextDark = !dark;
    const root = document.documentElement;
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (updateCallback: () => void) => {
        finished: Promise<void>;
      };
    };
    root.style.setProperty("--theme-reveal-x", `${event.clientX}px`);
    root.style.setProperty("--theme-reveal-y", `${event.clientY}px`);

    const canTransition =
      typeof viewTransitionDocument.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canTransition) {
      applyTheme(nextDark);
      return;
    }

    root.classList.add("theme-reveal");
    const transition = viewTransitionDocument.startViewTransition(() =>
      applyTheme(nextDark),
    );
    void transition.finished.finally(() => root.classList.remove("theme-reveal"));
  }

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      onClick={toggle}
      className="grid size-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm transition-colors hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-maroon)]"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
