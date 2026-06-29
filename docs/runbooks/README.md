# Operations runbooks

Operational runbooks for AURA (Ashesi University Resource Allocation) (spec §15, §18). Each
runbook is task-focused: symptoms, how to confirm, how to fix, and how to verify
recovery. Keep them current — the Definition of Done (§19.2) requires updating a
runbook whenever operational behaviour changes.

| Runbook | When to use |
|---|---|
| [slos-and-alerts.md](./slos-and-alerts.md) | SLO definitions, error budgets and the full alert catalogue. |
| [failed-import-recovery.md](./failed-import-recovery.md) | A timetable import (FR4) failed or partially applied. |
| [stuck-job-queue.md](./stuck-job-queue.md) | River jobs are backing up, retrying or not running. |
| [db-failover.md](./db-failover.md) | PostgreSQL primary is unhealthy or has failed over. |
| [replica-lag.md](./replica-lag.md) | The read replica is lagging the primary. |
| [secret-rotation.md](./secret-rotation.md) | Routine or emergency rotation of keys/credentials. |
| [restore-from-backup-drill.md](./restore-from-backup-drill.md) | Quarterly PITR restore drill and real recovery. |

## On-call essentials

- **Paging:** Grafana/Prometheus alert rules → Opsgenie (§15).
- **Dashboards:** Grafana (RED per endpoint, USE per resource, domain metrics).
- **Logs:** Grafana Loki; filter by `correlation_id` to trace a request.
- **Traces:** Tempo; trace IDs are embedded in logs for correlation.
- **Errors:** Sentry.
- **Health:** `GET /healthz` (process), `GET /readyz` (DB + migration + Redis).

## Conventions used below

- `NS` = Kubernetes namespace, e.g. `cbs-production`.
- Commands assume `kubectl` context set to the target cluster and `helm`
  pointed at `deploy/helm/cbs`.
