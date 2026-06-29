# AURA — Brand & Identity

The single source of truth for naming, voice, colour, and typography across the
web, mobile, and API. Update this first; surfaces follow.

## Name

- **Product name:** **AURA**
- **Full name:** **AURA — Ashesi University Resource Allocation**
- **Project title:** *AURA: A Smart Classroom and Facility Reservation System for Ashesi University*
- **Owner:** Ashesi University (built to read as an official internal system, not a student project)

> AURA is deliberately broader than "classroom booking" so the name stays relevant
> as it grows (see Future scope).

## Tagline

**Primary:** *Smart Space Management for Ashesi.*

Alternates (use where a different tone fits):
- Reserve. Manage. Learn.
- Simplifying Campus Space Reservations.
- Making Every Learning Space Count.
- The Smarter Way to Book Campus Spaces.

## Short description

> AURA is a web and mobile resource-allocation and reservation platform built for
> Ashesi University. It lets students, faculty, and administrative staff reserve
> classrooms and other campus facilities, with real-time availability, approval
> workflows, conflict detection, scheduling, and resource management.

## Future scope (why the name lasts)

Beyond classrooms, AURA can grow to book: lecture halls, classrooms, laboratories,
conference rooms, study rooms, auditoriums, sports facilities, and campus equipment.

## Colour palette (Ashesi identity)

Ashesi maroon/burgundy, white, and gray. Use maroon for primary actions and brand
marks; keep large surfaces white/paper; gray for text and structure.

| Token | Hex | Use |
|---|---|---|
| `maroon` (primary) | `#7B1113` | brand, primary buttons, active nav, links |
| `maroon-dark` | `#5E0D0F` | hovers, pressed states, headers |
| `maroon-tint` | `#F3E1E1` | subtle backgrounds, badges, highlights |
| `paper` (bg) | `#FBFBF9` | app background |
| `white` | `#FFFFFF` | cards, surfaces |
| `ink` (text) | `#23201F` | primary text |
| `gray` (muted) | `#6B6B6B` | secondary text |
| `border` | `#E6E3DF` | dividers, input borders |
| `success` | `#1E7D52` | approved / available |
| `warning` | `#B5740B` | pending |
| `danger` | `#B42318` | rejected / errors |

Contrast: maroon `#7B1113` on white passes WCAG AA for normal text. Keep status
colours distinct from maroon so "approved/pending/rejected" never reads as brand.

## Typography

- **Body / UI font: Outfit** (all body, labels, controls) — the requested primary.
- **Headings:** Outfit (use weights 600–700 for hierarchy). Optionally a heavier
  Outfit display weight for the landing hero.
- **Monospace:** system mono for codes/IDs.
- Load via `next/font` (web) and an Outfit font asset (mobile). Wire as the default
  sans so Tailwind `font-sans` → Outfit.

## Logo concept

- A stylised **A** forming the outline of a building/campus.
- A **location pin** or **calendar** integrated into the A to signal reservations.
- Ashesi colours: maroon/burgundy, white, gray.
- Clean, minimalist type for an enterprise-grade feel.
- Provide: full lockup (mark + "AURA" wordmark), mark-only (app icon/favicon), and a
  monochrome variant. Wordmark set in Outfit (600/700).

## Voice

Clear, calm, institutional. British English (matches the spec). Prefer plain verbs
("Reserve a room", "Approve request") over jargon.
