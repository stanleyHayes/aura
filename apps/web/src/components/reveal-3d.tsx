"use client";

import * as React from "react";
import { cn } from "@cbs/ui/lib/cn";

/**
 * Scroll-triggered 3D reveal. Wraps content and, when it scrolls into view,
 * animates it from a tilted/translated/transparent state to flat/opaque (a
 * perspective rotateX "card flip up" reveal). Pure CSS transform driven by an
 * `is-revealed` class (see `.aura-reveal-3d` in globals.css); honours
 * prefers-reduced-motion (the animation CSS is gated by motion-safe and the
 * element is fully visible by default when motion is reduced or JS is absent).
 *
 * `delay` staggers siblings (ms). `as` lets callers keep correct list semantics
 * (e.g. render as <li>).
 */
export function Reveal3D({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const fallback = window.setTimeout(() => setRevealed(true), 0);
      return () => window.clearTimeout(fallback);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return React.createElement(
    Tag,
    {
      ref,
      style: { transitionDelay: revealed ? `${delay}ms` : "0ms" },
      className: cn("aura-reveal-3d", revealed && "is-revealed", className),
    },
    children,
  );
}
