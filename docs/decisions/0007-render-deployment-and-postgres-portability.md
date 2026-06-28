# ADR-0007: Render deployment and PostgreSQL portability

**Status:** Accepted
**Date:** 2026-06-28

## Context

The spec (§18) targets Kubernetes (Helm) with managed PostgreSQL 18, managed
Redis/Valkey, and S3-compatible object storage. The operator has chosen to deploy
on **Render** instead. Render provides: Web Services and Background Workers (Docker
or native), managed PostgreSQL, managed **Key Value** (Redis/Valkey-compatible),
Cron Jobs, and static/Node web services — but **no managed S3**, and its managed
Postgres major version may lag the latest (PG 16/17, not necessarily 18).

The schema depends on one PG18-only built-in, **`uuidv7()`**. UUIDv7 is not
cosmetic: the cursor pagination (§8.1) orders by the time-ordered primary key, so
a v4 UUID would break "newest first" ordering.

## Decision

1. **UUIDv7 polyfill (portability).** Migration `00001` creates a guarded
   `public.uuidv7()` function *only when the server lacks the built-in*
   (`IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='uuidv7')`). It uses
   core functions only (`gen_random_uuid()` is built in since PG13). On PG18 the
   built-in is used; on Render's PG16/17 the polyfill is used. No table definition
   changes. Verified: valid UUID, version nibble = 7, monotonic ordering.

2. **Object storage is optional.** Timetable originals and report exports use the
   `S3_*` configuration. When unset, the API processes uploads in-memory and skips
   archiving the original; core booking/availability features need no object store.
   On Render, point `S3_*` at **Cloudflare R2 or AWS S3** (both S3-compatible), or
   run MinIO as a private service backed by a Render Disk.

3. **`$PORT`.** Render injects `PORT`; the config prefers it over `HTTP_PORT`.

4. **Blueprint.** `render.yaml` declares the full stack: a Postgres database, a
   Key Value (Redis) instance, the API Web Service (Docker, `/healthz` health
   check, `preDeployCommand` runs `goose` migrations), the Background Worker, and
   the Next.js web service. Secrets are set in the Render dashboard, never in repo.

5. **Extensions.** `btree_gist`, `pg_trgm`, and `citext` are on Render's
   supported-extensions allow-list, so `CREATE EXTENSION IF NOT EXISTS` succeeds.

## Consequences

- The Helm chart and Terraform (deploy/) remain valid for the spec's K8s target;
  `render.yaml` is the chosen production path. Both are kept.
- Background jobs stay Postgres-backed (ADR-0002), so River works on Render
  unchanged; the booking-expiry sweep runs in the worker (or a Render Cron Job).
- If Render later offers PG18, the polyfill silently steps aside (guard fails) —
  no migration change required.
