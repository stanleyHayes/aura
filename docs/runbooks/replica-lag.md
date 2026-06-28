# Runbook: read-replica lag

Respond to the PostgreSQL read replica lagging the primary (§18.2). The replica
serves reporting and availability reads; significant lag risks **stale
availability data** and slow reports.

## Symptoms

- Alert: **replica lag** > 30 s (warn) / > 120 s (page).
- Availability search shows slightly stale state; reports look "behind".
- p95 latency breach on read-heavy endpoints if reads queue behind apply.

## 1. Quantify the lag

On the replica:

```sql
-- Seconds the replica is behind (0 when fully caught up and idle).
SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay;
```

On the primary:

```sql
SELECT client_addr, state, sent_lsn, replay_lsn,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_bytes_behind
FROM pg_stat_replication;
```

Confirm against the managed-database metric used by the alert
(`pg_replication_lag_seconds`).

## 2. Find the cause

| Cause | Signature | Action |
|---|---|---|
| Write burst on primary | High WAL generation; lag tracks a traffic spike | Usually self-heals; mitigate reads (§4) until caught up. |
| Long-running read on replica | A big report query holds apply back (`max_standby_streaming_delay`) | Identify and cancel the query (§3); reschedule heavy reports off-peak. |
| Replica undersized | Replica CPU/IO pegged vs primary | Scale the replica instance class (Terraform). |
| Network / managed event | Cloud event, maintenance, AZ issue | Check the database console; open `db-failover.md` if the replica is unhealthy. |

## 3. Identify and cancel a blocking query (if applicable)

```sql
-- On the replica: long-running queries that may be delaying WAL apply.
SELECT pid, now() - query_start AS runtime, state, left(query, 120) AS query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY runtime DESC
LIMIT 10;

-- Cancel a specific offender (verify the pid first).
SELECT pg_cancel_backend(<PID>);
```

## 4. Mitigate while lag is high

- **Route critical reads to the primary** temporarily. If the app supports it,
  unset/redirect `DATABASE_REPLICA_URL` so availability reads hit the primary and
  stay fresh. Revert once lag recovers.
- **Throttle heavy reporting:** pause or defer large async report exports
  (worker) until the replica catches up — see `stuck-job-queue.md` to manage the
  export jobs.

## 5. Persistent or growing lag

- Scale the replica (instance class / IOPS) via Terraform:

  ```sh
  # Edit deploy/terraform/environments/<env>/terraform.tfvars (postgres_instance_class),
  # then:
  cd deploy/terraform
  terraform plan  -var-file=environments/<env>/terraform.tfvars
  terraform apply -var-file=environments/<env>/terraform.tfvars
  ```

- Consider adding a dedicated replica for reporting so ad-hoc heavy queries do
  not contend with availability reads.

## 6. Verify recovery

- `replication_delay` back under the alert threshold and stable.
- Availability search reflects recent bookings/lectures.
- Reads re-routed to the replica (if you moved them to the primary in §4).
- Replica-lag alert cleared.

## Prevention

- Schedule heavy reports off-peak; cap report query cost.
- Size the replica to keep pace with primary write volume.
- Alert at 30 s so lag is addressed before it reaches user-visible staleness.
