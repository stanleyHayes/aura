# AURA — Ashesi University Resource Allocation

**Smart Space Management for Ashesi.**

AURA is a web and mobile resource-allocation and reservation platform built for
**Ashesi University**. It ingests the per-semester lecture timetable, derives
real-time room availability from that timetable plus ad-hoc reservations and
maintenance windows, lets students, faculty and staff search and reserve campus
facilities, runs an approval workflow, and produces utilisation reporting.

The name is deliberately broad: beyond classrooms, AURA can grow to cover lecture
halls, labs, conference and study rooms, auditoriums, sports facilities, and campus
equipment. See [BRAND.md](BRAND.md) for identity and [ARCHITECTURE.md](ARCHITECTURE.md)
for how it's built.

Built to [`Classroom_Booking_System_Technical_Specification.md`](Classroom_Booking_System_Technical_Specification.md). British English throughout.

> **Central design rule (§2):** lecture occupancy and booking occupancy are stored
> **separately**. Lectures are recurring `timetable_events` scoped to a semester;
> ad-hoc reservations are `bookings`. Availability is *computed* from both (plus
> maintenance). Replacing a semester timetable never touches bookings.

---

## Stack

| Layer | Technology |
|---|---|
| API | **Go 1.25** modular monolith · chi · pgx/v5 · **sqlc** · goose |
| Database | **PostgreSQL 18** (UUIDv7, range types, exclusion constraints, generated columns) |
| Web | Next.js 16 (App Router, React 19.2) · Tailwind v4 · shadcn/ui · TanStack Query |
| Mobile | Expo SDK 56 (React Native 0.85) · expo-router · NativeWind v4 |
| Infra | Render (`render.yaml`) **or** Kubernetes (`deploy/helm`) + Terraform |

## What is implemented and verified

The backend — the spec's prioritised technical core (§0.2) — is complete and
**verified against real PostgreSQL 18**:

- **Database** (§6): full schema, exclusion constraints, the booking validation
  trigger, append-only audit, all in goose migrations. Portable to PG 16/17 via a
  guarded `uuidv7()` polyfill (for Render).
- **Availability engine** (§7.1): pure interval math at **100 % test coverage**,
  wired to the DB; honours half-open adjacency (a lecture ending at 10:00 leaves
  the room free from 10:00).
- **Bookings** (§7.2–7.3): submission-time conflict detection (BR1/BR3/BR4), the
  approval state machine, and the **concurrency-safe approval** — a per-room
  advisory lock plus the partial `EXCLUDE` constraint. The mandatory concurrency
  test (§16) passes: N officers approve competing requests, exactly one wins, the
  rest get `409 SLOT_NO_LONGER_AVAILABLE`, and the DB ends with one approved row.
- **iam** (§9): Argon2id passwords, JWT access tokens, rotating refresh tokens with
  reuse detection, login lockout, TOTP MFA, the §9.4 RBAC permission matrix, no
  user enumeration.
- **catalogue, scheduling** (timetable CSV/xlsx ingestion), **notifications**
  (in-app + SSE + email + push hooks), **reporting** (utilisation/bookings/conflicts
  + CSV export), **idempotency**, **RFC 9457** errors, audit logging.
- **Security & ops**: per-user/per-IP rate limiting (stricter on `/auth`, IETF
  `RateLimit-*` headers), security headers (CSP/HSTS/nosniff/frame-deny), Prometheus
  domain metrics at `/metrics`, read-replica routing for availability/reporting.
- **OpenAPI** contract at [`api/openapi.yaml`](api/openapi.yaml) (validated;
  generate the typed client with `openapi-typescript`).

**Tests:** 34 Go test functions, all green; the availability interval engine is at
100 % coverage; `golangci-lint` reports 0 issues. Integration tests (run against
real PostgreSQL 18) cover the mandatory approval-concurrency race, BR1–BR6, refresh
rotation + reuse detection, lockout, CSV ingestion, and utilisation reporting.

The **web** (`apps/web`), **mobile** (`apps/mobile`), Helm/Terraform (`deploy/`)
and CI (`.github/workflows`) are scaffolded to the spec and type-check; wire them
to a running API to exercise the journeys end-to-end.

See [`docs/decisions/`](docs/decisions) for ADRs (toolchain, jobs, Render
portability, calendar UI, infra choices) and [`docs/runbooks/`](docs/runbooks).

---

## Run it locally

### Option A — no Docker (isolated local Postgres)

Requires Go 1.25+, PostgreSQL 18 client tools, `goose` and `sqlc` on `PATH`.

```bash
make localdb     # initdb an isolated cluster on :5433, migrate, seed
make run-api     # start the API on :8080
```

### Option B — Docker Compose (full stack)

```bash
make dev         # Postgres, Valkey, MinIO, Mailpit, API, worker
```

### Default seed users (dev only — password `Password123!`)

| Email | Role |
|---|---|
| `admin@cbs.example.edu` | SYSTEM_ADMIN |
| `timetable@cbs.example.edu` | TIMETABLE_ADMIN |
| `officer@cbs.example.edu` | BOOKING_OFFICER |
| `lecturer@cbs.example.edu` | REQUESTER |

### Smoke test

```bash
curl -s localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"lecturer@cbs.example.edu","password":"Password123!"}'
```

---

## Tests

```bash
make test-unit        # pure unit tests (interval math, parsing) — no DB
make pg-start         # start the local test cluster
TEST_DATABASE_URL="postgres://$USER@localhost:5433/cbs?sslmode=disable" make test
```

The interval engine is at 100 % coverage; the concurrency and conflict tests run
against a real PostgreSQL 18 (they skip when `TEST_DATABASE_URL` is unset).

---

## Deploy to Render

The repo ships a [`render.yaml`](render.yaml) Blueprint: managed Postgres, a Key
Value (Redis) instance, the API (Docker, `/healthz` health check, migrations run as
the pre-deploy step), the worker, and the Next.js web service.

1. Push to a Git provider; in Render choose **New + → Blueprint** and select the repo.
2. Set the secrets Render leaves blank: `MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`),
   `CORS_ALLOWED_ORIGINS`, and any `MAIL_*`.
3. For uploads/exports, point `S3_*` at Cloudflare R2 / AWS S3 (Render has no S3).

See [ADR-0007](docs/decisions/0007-render-deployment-and-postgres-portability.md).

---

## Repository layout

```
/cmd/{api,worker,migrate}   Go entrypoints
/internal/<module>          iam · catalogue · scheduling · availability · bookings · notifications · reporting
/internal/platform          db (pgx+sqlc) · auth · rbac · httpx · config · audit · mailer · logging
/db/{migrations,queries,seed}   goose SQL · sqlc queries · seed data
/api/openapi.yaml           API contract (source of truth)
/apps/{web,mobile}          Next.js · Expo
/packages                   shared api-client · schemas · ui · config
/deploy/{compose,render,helm,terraform}   local · Render · Kubernetes · IaC
/docs/{decisions,runbooks}  ADRs · ops runbooks
```
