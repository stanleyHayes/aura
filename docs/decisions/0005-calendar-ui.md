# ADR-0005: Calendar / availability UI — custom grid + Schedule-X

**Status:** Accepted
**Date:** 2026-06-28
**Deciders:** Web frontend
**Relates to:** §10.1 (calendar/scheduling UI), §7.7 (calendar view), FR6/FR10

## Context

The product needs two distinct time visualisations:

1. **Availability grid** — the "room-as-resource" view (rooms down the y-axis,
   time across the x-axis) is the ideal way to read availability for a building
   on a day. The natural off-the-shelf component for this is FullCalendar's
   **resource-timeline**, which is a **paid** add-on. §10.1 explicitly forbids
   pulling it in.
2. **Day / week / month calendar** — a conventional calendar for the unified
   block feed from `GET /api/v1/calendar` (lectures, bookings, maintenance,
   computed available gaps), colour-coded by source (§7.7).

Options considered:

- **FullCalendar (MIT day/week/month) + resource-timeline (paid).** Rejected:
  the timeline is the paid tier; §10.1 forbids it. Using only the MIT views
  leaves the resource view unsolved.
- **FullCalendar MIT views + a hand-built resource grid.** Viable but pulls in
  FullCalendar's imperative API and its own theming, which fights Tailwind v4
  tokens.
- **Schedule-X (MIT) for day/week/month + a hand-built resource grid.**
  Schedule-X is MIT, React-friendly, themeable, and covers the conventional
  calendar cleanly. The resource grid — which no free library does well — is a
  small, well-scoped custom component built directly on our design tokens.

## Decision

Adopt the **default recommended in §10.1**:

- **Custom availability grid** — a bespoke, accessible CSS-grid component
  (`<AvailabilityGrid>`) renders rooms × time with free/occupied bands sourced
  from the availability engine (`free_intervals`) and the calendar block feed.
  It owns no scheduling logic; it is a pure presentation of server data. This
  keeps full control over Tailwind v4 tokens, keyboard operability, and the
  colour legend (lecture / booking / maintenance / available).
- **Schedule-X (`@schedule-x/react` + `@schedule-x/calendar`)** for the
  day/week/month calendar that renders the unified block feed.

Both render exclusively in the institution timezone (`Africa/Accra`,
configurable) via the shared `@cbs/ui/lib/datetime` helpers — never the
browser's implicit local zone (§8.1, §10.1).

## Consequences

- No paid dependency; licence-clean (§0.3 dependency discipline).
- The custom grid is our code to test and maintain, but it is small and the
  scheduling correctness lives server-side (§7.1), so the grid only renders.
- Schedule-X theming is bridged to our tokens via a thin CSS layer.
- If a richer resource timeline is later justified, the grid is replaceable
  behind its props contract without touching pages.
