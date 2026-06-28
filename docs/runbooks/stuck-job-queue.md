# Runbook: stuck or backed-up job queue

Diagnose and clear a backed-up River job queue (§5.2, §7.8). River stores jobs in
PostgreSQL; the `cmd/worker` binary runs the workers. Jobs cover notifications,
timetable imports, async report exports and the booking-expiry sweep (§7.2).

## Symptoms

- Alert: **job-queue backlog** (depth > 500 or oldest job > 5 min).
- Notifications/emails delayed; report exports never complete; bookings not
  expiring on schedule.
- Worker pods crash-looping or `CrashLoopBackOff`.

## 1. Triage: is the worker running?

```sh
kubectl -n "$NS" get pods -l app.kubernetes.io/component=worker
kubectl -n "$NS" logs deploy/cbs-worker --since=15m --tail=200
```

- `CrashLoopBackOff` → go to **§3 worker down**.
- Running but idle while the queue grows → go to **§4 not processing**.

## 2. Triage: inspect the queue in PostgreSQL

River exposes job state in its tables. Inspect depth, retries and the oldest job:

```sql
-- Queue depth by state.
SELECT state, count(*) FROM river_job GROUP BY state ORDER BY 2 DESC;

-- Oldest available (waiting) jobs.
SELECT id, kind, queue, attempt, max_attempts, scheduled_at, errors
FROM river_job
WHERE state = 'available'
ORDER BY scheduled_at ASC
LIMIT 20;

-- Jobs exhausting retries (poison candidates).
SELECT id, kind, attempt, max_attempts, finalized_at,
       errors -> -1 ->> 'error' AS last_error
FROM river_job
WHERE state IN ('retryable','discarded')
ORDER BY attempt DESC
LIMIT 20;
```

## 3. Worker down (crash-loop)

1. Read the crash reason: `kubectl -n "$NS" describe pod <pod>` (OOMKilled?
   config/secret missing? panic at startup?).
2. **OOMKilled** → raise `worker.resources.limits.memory` in values and
   `helm upgrade`.
3. **Missing config/secret** → confirm the ConfigMap and Secret/ExternalSecret
   exist and the keys match §19.1:

   ```sh
   kubectl -n "$NS" get configmap,secret,externalsecret -l app.kubernetes.io/instance=cbs
   kubectl -n "$NS" describe externalsecret cbs   # is it Synced?
   ```

4. **Startup panic** → check Sentry/logs; if a bad deploy, `helm rollback cbs`.
5. Jobs are durable in Postgres, so once the worker is healthy it resumes
   processing automatically. No data is lost on a crash.

## 4. Running but not processing

- **Throughput too low for the load:** scale workers.

  ```sh
  helm upgrade --install cbs deploy/helm/cbs -n "$NS" \
    -f deploy/helm/cbs/values-<env>.yaml --reuse-values \
    --set worker.replicaCount=3
  ```

- **Downstream dependency failing** (SMTP, S3, push): the same job kind retries
  in a tight loop. Confirm egress and credentials; check the mail provider and
  S3 status. Fix the dependency; retries then succeed.
- **Stuck/leaked `running` jobs** (worker died without finalising): River
  reclaims jobs whose lease expired. If a job is wedged `running` well past its
  timeout, confirm no worker holds it, then let River's rescue process recover it
  (do not delete `running` rows blindly).

## 5. Poison jobs (repeated failure)

A single malformed job can dominate the backlog by retrying.

1. Identify it from the `retryable`/`discarded` query in §2.
2. Determine if it is genuinely undeliverable (e.g. a notification to a deleted
   user, an export of a removed report).
3. Cancel/discard the specific job (preferred via River's admin API/CLI). If
   operating directly on the table, scope to the exact `id` and move it to
   `cancelled`/`discarded` — never bulk-delete by `kind`:

   ```sql
   -- Scope to ONE id. Verify the row first.
   UPDATE river_job
   SET state = 'cancelled', finalized_at = now()
   WHERE id = <JOB_ID> AND state IN ('retryable','available');
   ```

4. File a bug for the root cause so the job kind handles the edge case.

## 6. Verify recovery

- `river_job` `available` depth and oldest-job age back to baseline.
- Notifications/exports flowing; booking-expiry sweep running on schedule.
- No worker restarts in the last 15 min; backlog alert cleared.

## Prevention

- Set sensible `max_attempts` and backoff per job kind so poison jobs discard
  rather than retry forever.
- Alert early (depth and oldest-age) so backlog is caught before SLO impact.
- Keep the worker PDB `minAvailable: 0` only because jobs are durable — never
  rely on the worker for request-path work.
