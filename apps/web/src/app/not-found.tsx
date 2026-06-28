import Link from "next/link";
import { Button } from "@cbs/ui/components/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm text-[var(--color-muted-foreground)]">404</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          The page may have moved, or you may not have access to it.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
