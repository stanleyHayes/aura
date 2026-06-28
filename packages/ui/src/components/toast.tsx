"use client";

/**
 * Minimal accessible toast system (§12.2) — no extra runtime dependency.
 * A live region announces toasts; Radix is intentionally not used here so the
 * toaster can be driven imperatively from anywhere via `useToast()`.
 */
import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "../lib/cn";

export type ToastVariant = "default" | "success" | "warning" | "destructive";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastInput = Omit<ToastItem, "id">;

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const item: ToastItem = { id, duration: 5000, variant: "default", ...input };
      setToasts((prev) => [...prev, item]);
      if (item.duration && item.duration > 0) {
        window.setTimeout(() => dismiss(id), item.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="size-5 text-[var(--color-info)]" />,
  success: <CheckCircle2 className="size-5 text-[var(--color-success)]" />,
  warning: <TriangleAlert className="size-5 text-[var(--color-warning)]" />,
  destructive: <XCircle className="size-5 text-[var(--color-destructive)]" />,
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg animate-[slide-up_200ms_ease-out]",
          )}
        >
          <span aria-hidden="true" className="mt-0.5">
            {variantIcon[t.variant ?? "default"]}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--color-card-foreground)]">
              {t.title}
            </p>
            {t.description ? (
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {t.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-ring)]"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
