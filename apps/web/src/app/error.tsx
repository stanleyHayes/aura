"use client";

import { useEffect } from "react";
import { Button } from "@cbs/ui/components/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(observability): forward to Sentry (@sentry/nextjs) per §15.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          An unexpected error occurred. You can try again, or return to the
          dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
