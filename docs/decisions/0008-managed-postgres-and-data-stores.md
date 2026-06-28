# ADR-0008: Managed PostgreSQL (and managed Redis/S3) over self-hosted

**Status:** Accepted
**Date:** 2026-06-28

## Context

§18.2 calls for "managed PostgreSQL 18, primary + read replica … automated
encrypted backups + PITR, connection pooling" and "managed Redis/Valkey 8" and
"S3 (managed) or MinIO (self-host)". §18.3 sets RPO (≤ 24 h, ideally ≤ 15 min via
PITR), encrypted tested backups and quarterly restore drills. The correctness of
the system rests on database-level invariants — the `btree_gist` exclusion
constraint and the `fn_validate_booking` trigger (§6.6, §6.7) — so the database
is the single most safety-critical component.

Options for PostgreSQL:

1. **Managed PostgreSQL 18** (e.g. RDS/Aurora-Postgres, Cloud SQL, Azure
   Database) with Multi-AZ, a read replica and PITR.
2. **Self-hosted on Kubernetes** via an operator (CloudNativePG, Zalando,
   Crunchy).
3. **Self-hosted on dedicated VMs.**

## Decision

Use **managed PostgreSQL 18** as the reference (Terraform `modules/postgres`:
primary, optional read replica, PITR, Multi-AZ, KMS-encrypted storage,
TLS-enforced). Likewise use **managed Redis/Valkey** (`modules/redis`,
Multi-AZ, TLS at rest and in transit) and **managed S3** (`modules/object_storage`,
private, versioned, KMS, TLS-only). MinIO remains the local-dev and self-host
fallback (already used in `deploy/compose`).

Reasons:

- **Backups, PITR and failover are exactly what managed offerings do best.** The
  spec's RPO/RTO and quarterly-restore requirements (§18.3) are met with far less
  operational risk than hand-rolling WAL archiving and standby promotion.
- **The database must be boring and reliable.** With all correctness invariants
  in the DB, we want a managed control plane handling failover (see
  `db-failover.md`) rather than carrying that on-call burden ourselves.
- **PostgreSQL 18 specifically** is required (`uuidv7()`, range types,
  `btree_gist` exclusion constraints, generated columns — ADR-0001); managed
  PG 18 provides it without us managing extensions/patching.
- Keeping data stores off the cluster lets Kubernetes run only stateless
  workloads (ADR-0006), simplifying the cluster considerably.

## Consequences

- Cloud lock-in at the data tier, accepted deliberately for reliability. The
  Terraform is modular so a different managed Postgres (or a CloudNativePG
  self-host) can replace `modules/postgres` behind the same outputs
  (`primary_connection_url`, `replica_connection_url`).
- Connection pooling: rely on the managed pooler / pgx pool; PgBouncer can be
  added if connection counts from HPA-scaled API pods approach limits (see the
  DB-saturation alert in `slos-and-alerts.md`).
- Cost is higher than self-hosting, justified by the safety-critical role of the
  database and the §18.3 DR obligations.
- An institution mandating self-host on K8s swaps in a Postgres operator; the
  application and the rest of the stack are unaffected.
