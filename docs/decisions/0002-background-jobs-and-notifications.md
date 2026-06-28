# ADR-0002: Background jobs, notifications and async dispatch

**Status:** Accepted
**Date:** 2026-06-28

## Context

Section 5.2 selects `riverqueue/river` for Postgres-backed transactional jobs, and
§7.8 requires channel-agnostic notification dispatch (email + in-app + push) that
never blocks the request path. River commits jobs atomically with the work that
enqueues them.

## Decision

Define a **`jobs.Enqueuer` interface** and a **`notifications.Dispatcher`
interface** in the domain layer. Cross-module code depends only on these
interfaces, exactly as it would with River.

For this MVP build the default `Enqueuer` is an **in-process worker pool** that:

- persists each notification to the `notifications` table (the in-app channel,
  the durable source of truth), and
- dispatches email/push asynchronously off the request goroutine.

This preserves the contract — handlers enqueue and return immediately — while
keeping the build runnable without a separate broker. **River drops in behind the
same interface** for production (Postgres-backed durability, retries, the
`EXPIRED`-sweep cron) without touching call sites. The `cmd/worker` binary is the
seam where River's client is wired in production.

## Consequences

- Notifications are durable (DB row) immediately; transport delivery is best-effort
  async in MVP and at-least-once with River in production.
- The booking-expiry sweep (§7.2) runs as a periodic goroutine in `cmd/worker`
  today; it becomes a River periodic job in production with no domain change.
