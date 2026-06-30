# AURA — Mobile (`apps/mobile`)

Expo SDK 56 (React Native 0.85, React 19.2) app for **AURA — Ashesi University
Resource Allocation**. Two audiences (Section 13 of the spec):

- **Requesters** — search availability, request bookings, track status.
- **Booking officers** — review pending requests and approve/reject on the go.

British English is used throughout the UI copy.

## Stack

| Concern | Library |
|---|---|
| Routing | `expo-router` (file-based, typed routes) |
| Server state | `@tanstack/react-query` v5 (+ AsyncStorage persistence) |
| Forms | `react-hook-form` + `zod` v4 + `@hookform/resolvers` |
| Styling | NativeWind v4 + Tailwind CSS v4 (shared token values) |
| Tokens | secure store via `expo-secure-store` |
| Push | `expo-notifications` (Expo Push) |
| Calendar | `expo-calendar` (add approved bookings) |
| Biometrics | `expo-local-authentication` (optional unlock) |
| Camera | `expo-camera` (declared only — QR check-in is Phase 2) |
| API client | `openapi-fetch` over the typed `paths` |
| Crash/perf | `@sentry/react-native` |

> **Self-contained note.** This app ships a *local copy* of the typed API client
> (`src/api/openapi-types.ts`) and the zod schemas (`src/schemas/index.ts`).
> These mirror the canonical `/packages/api-client` and `/packages/schemas`.
> Each carries a `TODO(packages)` to switch to the shared workspace versions once
> the monorepo wiring lands.

## Project layout

```
app/                         # expo-router routes
  _layout.tsx                # providers, Sentry, auth gate, notification deep-links
  index.tsx                  # role-based redirect (officer → approvals, else search)
  (auth)/login.tsx           # email + password (+ MFA) → tokens in secure store
  (requester)/               # requester tab group
    search/                  # search → results → request (nested stack)
    bookings/                # my bookings list
    notifications.tsx
    settings.tsx             # biometric unlock toggle, sign out
  (officer)/                 # booking officer tab group
    approvals.tsx            # pending queue → approve / reject (note)
    notifications.tsx
    settings.tsx
  booking/[id].tsx           # detail / status timeline, cancel, add-to-calendar
src/
  api/                       # client, hooks, query keys, query client, errors, openapi types
  schemas/                   # zod schemas (local copy)
  features/                  # auth context + shared screens
  lib/                       # secure-store, datetime, push, biometrics, calendar, sentry
  components/                # UI primitives + providers
  theme/                     # design tokens (mirrors /packages/ui)
```

## Local development

```bash
# from apps/mobile
pnpm install            # or npm install
cp .env.example .env    # set EXPO_PUBLIC_API_BASE_URL if not localhost:8080

pnpm typecheck          # tsc --noEmit
pnpm lint
pnpm start              # Expo dev server (run a device/emulator yourself)
```

The API defaults to `http://localhost:8080/api/v1`. On a physical device, set
`EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP.

## Auth & tokens (Section 9.1)

- Bearer **access** (15 min) + opaque **refresh** (rotated on every refresh)
  are stored in `expo-secure-store` — never AsyncStorage.
- The API client (`src/api/client.ts`) attaches the access token, and on a `401`
  performs a **single-flight** refresh. If the refresh is rejected (rotation /
  reuse detection revoked the family), the session is cleared and the user is
  routed back to login.
- **Lockout/backoff** is server-driven; the client surfaces the RFC 9457
  `ACCOUNT_LOCKED` problem and field-level errors on the login screen.
- **Biometric unlock** (optional, Settings) gates revealing an existing session
  on cold start via `expo-local-authentication`.

## Push notifications & deep links (Section 13)

- On sign-in the app registers its Expo push token via `POST /api/v1/devices`.
- Tapping a booking push (`data.bookingId` / `relatedEntityId`) deep-links to
  `/booking/<id>`. The app owns the `aura://` scheme plus universal/app links on
  `https://app.aura.ashesi.edu/booking/*` (see `app.config.ts`).

## Offline read-only caching (Section 13)

> "Read-only caching of last availability/calendar via React Query persistence;
> mutations require connectivity (booking is inherently online)."

Implementation:

- `PersistQueryClientProvider` (in `src/components/providers.tsx`) persists the
  React Query cache to **AsyncStorage** with a 24h max age.
- Only read-only domain caches are dehydrated — `availability`, `calendar`,
  `bookings`, `rooms`, `me` (allow-list in `src/api/query-client.ts`). Everything
  else, and **all mutations**, are excluded so nothing is replayed offline.
- Mutations use `retry: false`; when offline they fail fast and the UI shows a
  "No connection" message. Booking create/approve/reject/cancel require
  connectivity by design.
- Lists use pull-to-refresh and `refetchOnReconnect` so cached views update as
  soon as the network returns.

## EAS build / submit / OTA

Channels are defined in `eas.json` and selected per build profile; the active
EAS Update channel is matched to the build channel. `runtimeVersion` uses the
**fingerprint** policy so OTA updates only land on compatible binaries.

```bash
# one-time
npm i -g eas-cli
eas login
eas init                 # writes the EAS project id; also set EAS_PROJECT_ID

# Builds (APP_VARIANT comes from the profile's env in eas.json)
eas build --profile development --platform ios     # dev client
eas build --profile staging     --platform all     # internal QA
eas build --profile production  --platform all

# Store submission
eas submit --profile production --platform ios
eas submit --profile production --platform android

# OTA JS/asset patches (no store review) — push to the matching channel
eas update --channel staging    --message "Fix availability filter labels"
eas update --channel production  --message "Copy tweaks"
```

Profiles → channels:

| Profile | Channel | App name | Bundle id |
|---|---|---|---|
| `development` | `development` | AURA (Dev) | `edu.ashesi.aura.dev` |
| `staging` | `staging` | AURA (Staging) | `edu.ashesi.aura.staging` |
| `production` | `production` | AURA | `edu.ashesi.aura` |

Staging and production builds intentionally fail unless `EXPO_PUBLIC_API_BASE_URL`
is an HTTPS deployed API URL and `EAS_PROJECT_ID` is the real UUID from
`eas init`. Secrets (Sentry auth token, etc.) are provided via EAS secrets, never
committed.

## Testing

`jest-expo` is configured (`jest.config.js`) with `@testing-library/react-native`.
Add specs under `__tests__/`. E2E (Maestro/Detox) is out of scope for this
scaffold.

## Stubbed / deferred

- **OpenAPI types & zod schemas** are hand-authored local copies (see the
  self-contained note above); replace with the generated `/packages` versions.
- **QR check-in** — `expo-camera` permission is declared but no scanner UI is
  built (Phase 2, Section 4.3).
- **Institution timezone** rendering uses the device locale; a production build
  should resolve the institution TZ (e.g. `Africa/Accra`, Section 6.7).
- **EAS project id** is injected with `EAS_PROJECT_ID` until `eas init` writes the
  project id into the managed EAS project configuration.
```
