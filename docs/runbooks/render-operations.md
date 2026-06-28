# Runbook: Operating on Render

The other runbooks target the Kubernetes deployment (the spec's §18 topology). This
one covers the **Render** deployment defined by [`render.yaml`](../../render.yaml)
(see [ADR-0007](../decisions/0007-render-deployment-and-postgres-portability.md)).

## Services (from the Blueprint)

| Render resource | What it is | Source |
|---|---|---|
| `cbs-postgres` | Managed PostgreSQL (17) | Render database |
| `cbs-redis` | Key Value (Valkey/Redis) | Render Key Value |
| `cbs-api` | API Web Service (Docker) | `deploy/render/Dockerfile` → `/api` |
| `cbs-worker` | Background Worker (Docker) | same image → `/worker` |
| `cbs-web` | Next.js Web Service (Node) | `apps/web` |

## First deploy

1. Push the repo to GitHub/GitLab. In Render: **New + → Blueprint**, select the repo.
2. Render provisions the database, Key Value, and services from `render.yaml`.
3. Set the secrets Render leaves blank (Dashboard → each service → Environment):
   - `MFA_ENCRYPTION_KEY` — `openssl rand -base64 32`
   - `CORS_ALLOWED_ORIGINS` — the web service URL, e.g. `https://cbs-web.onrender.com`
   - `MAIL_*` — your transactional provider (Resend/Postmark/SES SMTP), optional
   - `S3_*` — Cloudflare R2 / AWS S3, only if you need uploads/exports
4. The API's `preDeployCommand` runs `/migrate up` automatically before each release.

## Migrations

- Run automatically on deploy (`preDeployCommand: /migrate up`).
- Manual run: Render Dashboard → `cbs-api` → **Shell** → `/migrate status` / `/migrate up`.
- Forward-only (expand → migrate → contract, §6.10). Never edit an applied migration;
  add a new one.

## Deploys & rollback

- **Deploy:** push to the deploy branch (auto-deploy) or **Manual Deploy** in the dashboard.
- **Rollback:** Dashboard → `cbs-api` → **Events/Deploys** → pick the last good deploy →
  **Rollback**. Roll back `cbs-worker` and `cbs-web` to matching versions. Because
  migrations are expand/contract, the previous image stays compatible with the new
  schema; if a contract migration already dropped a column, roll forward instead.

## Logs, metrics, health

- **Logs:** Dashboard → service → **Logs** (structured JSON; filter by `correlation_id`).
- **Health:** API exposes `/healthz` (liveness — Render health check) and `/readyz`
  (DB ping). `/metrics` serves Prometheus (`cbs_bookings_*`,
  `cbs_availability_search_seconds`, …) — scrape via an external Prometheus/Grafana or
  Render Metrics.

## Scaling

- API is stateless (JWT/cookies, no sticky sessions) → raise instance count freely.
- The in-memory rate limiter and SSE broker are **per-instance**. With >1 API instance,
  back them with `cbs-redis` (the `REDIS_URL` is already wired) — see ADR-0002 / §15.
- Worker should run a single instance (the expiry sweep is idempotent but needn't double-run).

## Database backups & restore

- Render Postgres takes automated daily backups + PITR (plan-dependent).
- **Restore drill (quarterly):** create a fork/restore from a recent backup into a new
  database, point a staging `cbs-api` at it, run `/migrate status`, smoke-test login +
  availability search. Document RPO/RTO actuals.

## Common incidents

| Symptom | First checks |
|---|---|
| 503 on `/readyz` | DB reachable? `cbs-postgres` status; connection limit; `DATABASE_URL` set |
| Logins failing 500 | `JWT_SIGNING_KEY` / `MFA_ENCRYPTION_KEY` set and valid (MFA key must be 32 bytes base64) |
| Emails not arriving | `MAIL_*` set? Without them the API logs emails instead of sending (by design) |
| Uploads/exports failing | `S3_*` unset → object storage features are disabled; wire R2/S3 |
| `uuidv7() does not exist` | Postgres < 18 without the polyfill — confirm migration `00001` ran (it self-installs the polyfill) |
| Slow availability search | Check `cbs_availability_search_seconds`; add `DATABASE_REPLICA_URL` to offload reads |
