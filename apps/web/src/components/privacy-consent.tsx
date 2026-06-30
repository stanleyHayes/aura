"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@cbs/ui/components/button";
import { route } from "@/lib/route";

/**
 * Lightweight cookie / data-use consent notice (Act 843 transparency).
 *
 * Shown on first visit to the public surface and dismissed once the visitor
 * acknowledges it. The acknowledgement is stored in localStorage under
 * `aura-privacy-ack` so it does not reappear on subsequent visits.
 *
 * SSR-safe: it renders nothing until mounted on the client, so the server and
 * the first client render agree (no hydration mismatch). It only decides to
 * show after reading localStorage, which is browser-only.
 */
const STORAGE_KEY = "aura-privacy-ack";
const CONSENT_EVENT = "aura-privacy-ack-change";
let sessionAccepted = false;

function hasAcknowledgedPrivacy() {
  if (sessionAccepted) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getPrivacyVisibilitySnapshot() {
  return !hasAcknowledgedPrivacy();
}

function getPrivacyVisibilityServerSnapshot() {
  return false;
}

function subscribeToPrivacyAcknowledgement(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_EVENT, callback);
  };
}

export function PrivacyConsent() {
  const visible = useSyncExternalStore(
    subscribeToPrivacyAcknowledgement,
    getPrivacyVisibilitySnapshot,
    getPrivacyVisibilityServerSnapshot,
  );
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Move focus to the Accept action when the notice appears, so keyboard and
  // screen-reader users land on it.
  useEffect(() => {
    if (visible) acceptRef.current?.focus();
  }, [visible]);

  function accept() {
    sessionAccepted = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures; dismissing for this session is acceptable.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-consent-title"
      aria-describedby="privacy-consent-desc"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 motion-safe:animate-[slide-up_200ms_var(--ease-out-quart)]"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--color-card-foreground)] shadow-lg sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p
            id="privacy-consent-title"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Your privacy
          </p>
          <p
            id="privacy-consent-desc"
            className="mt-1 text-sm leading-6 text-[var(--color-muted-foreground)]"
          >
            AURA uses strictly necessary cookies and local storage to keep you
            signed in and remember your preferences. We process personal data in
            line with Ghana&rsquo;s Data Protection Act, 2012 (Act 843). See our{" "}
            <Link
              href={route("/privacy")}
              className="text-[var(--color-primary)] underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0">
          <Button
            ref={acceptRef}
            onClick={accept}
            size="sm"
            className="w-full sm:w-auto"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
