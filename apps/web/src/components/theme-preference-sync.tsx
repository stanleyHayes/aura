"use client";

import * as React from "react";
import {
  applyDarkTint,
  applyThemeMode,
  readSavedDarkTint,
  readSavedThemeMode,
} from "@/lib/theme-preferences";

export function ThemePreferenceSync() {
  React.useEffect(() => {
    const sync = () => {
      applyThemeMode(readSavedThemeMode());
      applyDarkTint(readSavedDarkTint());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("aura-dark-tint-change", sync);
    window.addEventListener("aura-theme-change", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("aura-dark-tint-change", sync);
      window.removeEventListener("aura-theme-change", sync);
    };
  }, []);

  return null;
}
