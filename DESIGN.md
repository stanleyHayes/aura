# AURA — UI/UX Design Specification

The interaction and component spec for AURA's surfaces. It builds on
[BRAND.md](BRAND.md) (name, Ashesi maroon palette, **Outfit** typography) and the
technical spec §10–§13. Every pattern below is **mandatory** on the web app and the
target for mobile where applicable. British English throughout.

**Stack it maps onto:** Next.js 16 + React 19, Tailwind v4 (`@theme` tokens),
shadcn/ui + Radix primitives, `lucide-react`, Framer Motion (animations), the Web
Speech API (`speechSynthesis`) for text-to-speech, and the View Transitions API for
the theme reveal. Reuse `@cbs/ui` components; add new ones there so web + mobile share.

---

## 0. Principles & cross-cutting rules

- **Tokens, not hex.** Use the BRAND.md tokens (`--color-maroon`, `--color-ink`,
  `--color-paper`, …). Primary actions, active nav, links, focus rings = maroon.
- **Motion is purposeful and accessible.** Every animation below MUST honour
  `prefers-reduced-motion: reduce` — fall back to an instant state change or a
  simple opacity fade. Default durations 150–250 ms; easing `cubic-bezier(.2,.8,.2,1)`.
- **One pattern, one component.** The patterns here are shared components
  (`<PageHeader>`, `<EmptyState>`, `<DataPagination>`, `<Skeleton*>`, `<UserMenu>`,
  `<ThemeToggle>`, `<AppSidebar>`), not per-page reimplementations.
- **Accessibility is non-negotiable** (WCAG 2.2 AA, spec §12.2): full keyboard
  operability, visible focus, correct ARIA, contrast ≥ 4.5:1, screen-reader labels.
- **Responsive:** desktop ≥ 1024px shows the sidebar; below that it collapses to a
  drawer. Touch targets ≥ 44px.

---

## 1. Navigation — collapsible grouped sidebar / drawer

A left **sidebar** on desktop; a slide-in **drawer** (Radix Sheet) on mobile.

### 1.1 Anatomy
```
┌ Sidebar ──────────────┐
│ [AURA logo]      «     │  ← collapse toggle (« / »)
│                        │
│ ▾ Catalogue            │  ← GROUP (collapsible, heading + chevron)
│   │╭─ Rooms            │  ← items; connector line from group ↳ item
│   │╰─ Buildings        │
│   ╰── Equipment        │
│ ▸ Scheduling           │  ← collapsed group
│ ▾ Administration       │
│   ╰─ Users             │
│                        │
└────────────────────────┘
```

### 1.2 Behaviour
- **Sidebar collapse:** a toggle (`«`/`»`) collapses the whole sidebar to an icon
  rail (icons only, labels on hover tooltip). State **persists** (localStorage) and
  is restored on next visit. Animate width 250 ms.
- **Groups:** every nav group has a heading and is **collapsible** (chevron
  `▾`/`▸`). Group open/closed state persists per group. Animate height (collapse)
  with a fade; respect reduced-motion (toggle instantly).
- **Items & subgroups:** items nested under a group render with a **connector line**
  that visually ties each item to its parent group — see §1.3.
- **Active state:** the current route's item uses maroon text + a maroon left
  indicator bar; its parent group auto-expands.
- **Nested subgroups** (a group within a group) indent one level and continue the
  connector treatment.

### 1.3 The connector line (required)
Each item under a group shows a line that **descends from the group (the "main")
and curves into the item** — a rounded "branch" connector, like a file-tree elbow:

- A vertical "trunk" runs down the left of a group's items.
- For each item, a short horizontal stub **curves** off the trunk into the item
  (a rounded elbow, ~8px corner radius), pointing at the item's icon/label.
- The **last** item in a group uses an end-elbow (the trunk stops at it); middle
  items use a tee (trunk continues past).
- Colour: `--color-border` at rest; the **active** item's connector segment turns
  maroon. 1.5px stroke.
- Implement with an inline SVG per item (path with a quadratic/cubic curve for the
  elbow) or CSS pseudo-elements with `border-radius` on a corner; SVG is preferred
  for the smooth curve and the active-colour transition.

### 1.4 Accessibility
- Sidebar is a `<nav aria-label="Primary">`; groups are buttons with
  `aria-expanded`; the collapse toggle has an accessible label and `aria-pressed`.
- Full keyboard: Tab through groups/items, Enter/Space toggles a group, arrow keys
  optional. Connector lines are decorative (`aria-hidden`).
- Drawer (mobile) traps focus and closes on Esc / overlay click / route change.

---

## 2. Page pattern — header with icon, title, description, help, and action

**Every page** (requester + admin **and the auth pages**, §12) opens with a standard
`<PageHeader>`:

```
[▣]  Find a room                              [ Help (?) ]   [ + New booking ]
     Search live classroom availability and reserve a room.
```

- **Icon** — a leading `lucide` icon in a small maroon-tinted rounded container that
  represents the page (e.g. Search for find-a-room, ClipboardCheck for approvals,
  LayoutDashboard for the overview). Required on every page. Decorative
  (`aria-hidden`); the title carries the meaning.
- **Title** — the page name (Outfit 600, maroon-tinted ink).
- **Description** — one sentence on what the page is for.
- **Help icon** — a `?` button that opens a **popover** explaining *how to achieve
  what the page is for* (a short numbered "how to …" walk-through). The help content
  is the same text the user-guide TTS reads (§4). The popover is keyboard-openable,
  labelled, and dismissible.
- **Primary action button** — the page's main verb (e.g. *New booking*, *Add room*,
  *Upload timetable*). Right-aligned. Omitted only on read-only pages.

`<PageHeader icon title description helpHowTo action />` — one component, used
everywhere, so the layout and behaviour are identical across pages.

---

## 3. Empty states

Whenever a list/result set is empty (no search results, no bookings, no
notifications, empty report), render `<EmptyState>` with **four parts**:

1. **Animated icon** — a relevant `lucide` icon with a subtle looping micro-animation
   (e.g. a gentle float/pulse, or a draw-on via Framer Motion). Stops/!animates under
   reduced-motion.
2. **Title** — short, e.g. "No rooms match your search".
3. **Description** — a sentence guiding the user to the next step.
4. **Action button(s)** — 1–2 actions to resolve the emptiness (e.g. *Clear
   filters*, *Widen the time window*; or *Create the first room*). Primary = maroon.

`<EmptyState icon title description actions />`. Centre-aligned, generous padding,
`role="status"` so screen readers announce it.

---

## 4. Navbar — user/quick-actions menu (top-right)

A dropdown (Radix DropdownMenu) anchored to the user's avatar on the right of the top
bar. **Every item has an icon, a title, and a description line:**

| Item | Icon | Title | Description |
|---|---|---|---|
| Profile | `User` | Profile | View and edit your account details |
| Settings | `Settings` | Settings | Preferences, notifications, security (MFA) |
| User guide | `BookOpen` | User guide | Open the complete AURA workflow guide |
| Replay tour | `Map` | Replay tour | Play the first-login dashboard tour again |
| Logout | `LogOut` | Sign out | End your session on this device |

- Each row: icon (left), title (Outfit 500), description (muted, smaller) stacked.
- **User guide (text-to-speech, per page):** selecting it reads the **current page's**
  guide aloud using the Web Speech API (`window.speechSynthesis`). It speaks the page
  title + description + the "how-to" steps (the same content as the §2 help popover).
  Show a small playing indicator and a stop control while speaking. Provide a visible
  transcript for accessibility; never rely on audio alone.
- **First-login auto-tour + replay:** on a user's **first login** (a per-user flag
  persisted via the API/profile or localStorage), automatically offer/play the
  step-by-step dashboard tour once. **Replay tour** re-runs that tour on demand.
  Respect a "don't auto-play" preference and reduced-motion/`prefers-reduced-data`.
- Keyboard accessible; `aria-label`s on controls; the menu closes on select/Esc.

---

## 5. Theme toggle — circular reveal

A light/dark toggle in the top bar. On toggle, the new theme **reveals from the
toggle button outward in an expanding circle** (a clip-path circle growing to cover
the viewport), using the **View Transitions API** (`document.startViewTransition`)
with a `clip-path: circle()` animation centred on the button.

- Duration ~400 ms, ease-out. Fallback: browsers without View Transitions (or
  reduced-motion) switch instantly with a quick cross-fade.
- The toggle button shows sun/moon and has `aria-pressed` + label. Theme choice
  persists (localStorage) and respects the system preference on first visit.

---

## 6. Buttons — wave-form dotted loading animation

The standard `<Button>` gains a **loading** state shown as **three dots animating in
a wave** (each dot rises/falls in sequence, like an equaliser/"typing" wave), in the
button's foreground colour, replacing the label while keeping the button width stable
to avoid layout shift.

- The button is `disabled` + `aria-busy="true"` while loading; the label is
  announced to AT ("Saving…"). Under reduced-motion the dots show statically (or a
  simple opacity pulse) — no bouncing.
- Variants (primary/maroon, secondary, ghost, destructive) all support the loading
  wave. Used for every async action (login, submit booking, approve, upload, save).

---

## 7. Loading — skeletons everywhere (no spinners/text)

Replace circular spinners and "Loading…" text with **skeleton screens** that mirror
the page's real layout:

- Provide skeleton variants: `<SkeletonText>`, `<SkeletonCard>`, `<SkeletonTable>`,
  `<SkeletonStat>`, `<SkeletonCalendar>`, `<SkeletonList>`.
- Each page renders its own skeleton (matching its structure) while data loads —
  e.g. the rooms list shows skeleton room cards; the dashboard shows skeleton KPI
  tiles; tables show skeleton rows.
- Skeletons use a subtle flat pulse on `--color-border`/paper; animation stops
  under reduced-motion (static placeholder blocks).
- Wire via React Query `isLoading`/Suspense fallbacks and Next.js `loading.tsx` route
  segments so navigation shows the skeleton immediately. `aria-busy` on the region.

---

## 8. Pagination — on every list page

Every paged list (rooms, bookings, users, audit log, notifications, timetable
events, reports tables) uses a shared **`<DataPagination>`** control.

- The API is **cursor-based** (`?limit=&cursor=` → `{ data, next_cursor }`, spec
  §8.1). The control therefore supports **Next / Previous** via a cursor stack
  (push cursors as you page forward; pop to go back) and a **page-size selector**
  (e.g. 10 / 25 / 50). Show "Showing X–Y" and disable Next when `next_cursor` is null.
- A "Load more" affordance is an acceptable alternative for feed-style lists
  (notifications); list/table pages use the Prev/Next control.
- Keyboard accessible; buttons have labels; the active page-size is `aria-pressed`.
- Persist page size per list in localStorage.

---

## 9. Overview / dashboard page

A landing **Overview** page per role that summarises the whole application state at a
glance. Three bands:

1. **KPI stats** — a row of stat tiles (`<StatCard>`): e.g. *Pending approvals*,
   *Rooms available now*, *My upcoming bookings*, *30-day utilisation %*, *Conflicts
   this week*. Each tile: label, big value, small trend/sub-text, icon, and links to
   its detail page. Values come from the reporting + bookings + availability APIs.
   Use `<SkeletonStat>` while loading.
2. **Quick actions** — prominent buttons for the role's top tasks (requester:
   *Find a room*, *My bookings*; officer: *Review approvals*; admin: *Add room*,
   *Upload timetable*, *Run report*). Maroon primary.
3. **Recent activity / at-a-glance** — recent bookings or pending items, a mini
   calendar/utilisation chart, and unread notifications — each a card linking deeper.

Content is **role-aware** (RBAC §9.4): only show tiles/actions the user can access.
The Overview is the post-login default landing for each role.

---

## 10. Component inventory (add to `@cbs/ui` / web)

| Component | Spec § | Notes |
|---|---|---|
| `AppSidebar` (+ `NavGroup`, `NavItem`, `NavConnector`) | §1 | collapsible, grouped, curved connectors, persisted state |
| `PageHeader` | §2 | title + description + help popover + action |
| `EmptyState` | §3 | animated icon + title + description + actions |
| `UserMenu` | §4 | rich items (icon/title/description); guide TTS + replay |
| `PageGuide` / `useSpeech` | §2,§4 | per-page how-to content + `speechSynthesis` reader + transcript |
| `ThemeToggle` | §5 | circular reveal via View Transitions |
| `Button` (loading=wave dots) | §6 | wave-dot loader, `aria-busy`, reduced-motion |
| `Skeleton*` set | §7 | text/card/table/stat/calendar/list |
| `DataPagination` | §8 | cursor Next/Prev + page size |
| `StatCard`, Overview blocks | §9 | KPI tiles, quick actions, activity |

---

## 11. Motion & accessibility summary (applies to all of the above)

- Honour `prefers-reduced-motion: reduce` everywhere: sidebar/group animations,
  empty-state icon, theme circular reveal, button wave dots, skeleton shimmer, guide
  autoplay → all degrade to instant/static.
- Provide non-audio equivalents for the TTS guide (visible transcript + the §2 help
  popover).
- All interactive controls: keyboard reachable, visible maroon focus ring, correct
  roles/labels/`aria-expanded`/`aria-pressed`/`aria-busy`.
- Decorative elements (connector lines, animated icons) are `aria-hidden`.
- Verify with `axe` in CI (spec §12.2) and a manual keyboard + screen-reader pass on
  the sidebar, the user menu/guide, pagination, and the theme toggle.

---

## 12. Auth pages — complete redesign

The auth screens (login, forgot-password, reset-password, and the MFA step) are
**completely redesigned** around the AURA brand. They do not use the app sidebar;
they use a dedicated **split-screen** layout, and each screen carries the same
header anatomy as every other page: **icon + title + description + help + action**.

### 12.1 Layout
- **Split screen (desktop ≥ 768px):**
  - **Brand panel** (left, ~45%): solid maroon (`--color-maroon`), the AURA logo
    + wordmark, the tagline *"Smart Space Management for Ashesi."*, a one-line
    value sentence, and a subtle, tasteful motif (e.g. a faint
    campus/where-rooms line illustration or geometric "A" pattern). Decorative,
    `aria-hidden`.
  - **Form panel** (right, ~55%): a centred card on `--color-paper` with the
    page header + form.
- **Mobile (< 768px):** stack — a compact maroon brand bar (logo + tagline) on top,
  the form card below. Never hide the brand entirely.
- Card: rounded, soft shadow, generous padding, max-width ~ 420px. Outfit throughout.

### 12.2 Per-screen header (icon + title + description + help + action)
Each screen's card opens with the §2 pattern adapted for auth:

| Screen | Icon | Title | Description | Help (how-to) | Primary action |
|---|---|---|---|---|---|
| **Login** | `KeyRound` | Sign in to AURA | Access your Ashesi classrooms and facilities. | How to sign in; what to do if you've forgotten your password; first-time/MFA note | **Sign in** |
| **MFA step** | `ShieldCheck` | Two-factor verification | Enter the 6-digit code from your authenticator app. | Where the code comes from; lost-device guidance | **Verify** |
| **Forgot password** | `MailQuestion` | Reset your password | Enter your email and we'll send a reset link. | What happens next; check spam; link expiry (1h) | **Send reset link** |
| **Reset password** | `LockKeyhole` | Set a new password | Choose a new password for your account. | Password rules; that all sessions are signed out | **Update password** |

- The **help icon** opens the §2 popover and is wired to the §4 TTS guide (reads the
  how-to aloud) — so even unauthenticated users get the spoken walk-through.
- **Action buttons** use the §6 wave-dot loading state while submitting.

### 12.3 Forms, states & behaviour
- **Login:** email + password; an MFA code field appears (in-place transition to the
  MFA step) when the API returns `MFA_REQUIRED`. Secondary link: *Forgot password?*.
  Accounts are provisioned by administrators (no public sign-up) — show a quiet note
  ("Need an account? Contact your department administrator.") rather than a register
  link.
- **Validation & errors:** react-hook-form + the shared zod schemas; inline,
  field-associated error messages (`aria-describedby`). Map RFC 9457 codes to friendly
  copy — `INVALID_CREDENTIALS` → "Invalid email or password", `ACCOUNT_LOCKED` →
  "Too many attempts — try again in a few minutes", `INVALID_MFA_CODE`,
  `INVALID_TOKEN` (expired reset link → offer to request a new one).
- **Reset password:** new + confirm password with a **strength meter** and the
  rules from the API (min length); on success, a confirmation state with a *Sign in*
  action.
- **Forgot password:** always show the same success confirmation regardless of
  whether the email exists (no user enumeration, spec §9.1) — e.g. "If that address
  has an account, a reset link is on its way."
- Show/hide password toggle; Caps-Lock hint; autocomplete attributes
  (`username`, `current-password`, `new-password`, `one-time-code`).

### 12.4 Accessibility & motion
- Single `<h1>` per screen (the title); labelled inputs; visible maroon focus rings;
  logical tab order; the form card is the landmark, the brand panel is `aria-hidden`.
- Submit sets `aria-busy`; errors are announced (`role="alert"`).
- The split-panel reveal and any motif animation honour `prefers-reduced-motion`
  (fade/instant). The theme toggle (§5) is available on auth pages too.
