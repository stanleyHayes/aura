# Runbook: PostgreSQL failover

Respond to a PostgreSQL primary that is unhealthy, unreachable, or has failed
over (§18.2). The managed instance runs Multi-AZ; the platform performs the
failover automatically — this runbook covers confirming it, helping the app
recover, and the manual path if automation does not act.

## Symptoms

- Alert: error-rate burn and/or DB connection saturation; `/readyz` returning
  non-200 (DB ping fails).
- API logs: connection refused / timeout / "the database system is in recovery".
- Spike in 5xx on write paths; reads may still work via the replica.

## 0. Declare and communicate

- Treat as a Sev-1 if writes are failing. Acknowledge the page; post in the
  incident channel; note the start time for the post-incident review.

## 1. Confirm the database state

```sh
# Is /readyz failing because of the DB specifically?
kubectl -n "$NS" exec deploy/cbs-api -- wget -qO- localhost:8080/readyz || true
```

Check the managed-database console/CLI for instance status and recent events
(failover, reboot, storage). Determine whether a **failover is in progress**,
**already completed**, or **not happening**.

## 2. If automatic failover is in progress / completed

Multi-AZ promotes the standby and the **endpoint DNS is repointed** to the new
primary. The application should reconnect once DNS/TTL refreshes and the pgx pool
re-establishes connections.

1. Watch readiness recover:

   ```sh
   kubectl -n "$NS" rollout status deploy/cbs-api --timeout=5m
   kubectl -n "$NS" get pods -l app.kubernetes.io/instance=cbs -w
   ```

2. If pods are stuck on stale connections after the endpoint moved, recycle them
   to force a fresh pool (safe; stateless API):

   ```sh
   kubectl -n "$NS" rollout restart deploy/cbs-api deploy/cbs-worker
   ```

3. Confirm `DATABASE_URL` points at the **endpoint name**, not a pinned IP — a
   pinned IP defeats DNS failover. (It uses the managed endpoint per Terraform.)

## 3. If failover is NOT happening (manual path)

1. Verify the standby is healthy and caught up (low replication lag).
2. Trigger a managed failover/reboot-with-failover via the cloud
   console/CLI/Terraform. **Prefer the managed control plane** — do not attempt
   manual promotion of the underlying instance.
3. Watch the new primary come up; then proceed as in §2.

## 4. Protect the app while the primary is unavailable

- Reads can be served from the replica for availability/reporting (§18.2). If the
  app supports read-routing, confirm it is using `DATABASE_REPLICA_URL`.
- Do **not** disable the §6.7 booking-validation trigger or invariants to "get
  writes through" — that risks double-bookings (BR5). Accept failed writes until
  the primary is restored.

## 5. After the new primary is serving

- Confirm a replica is re-attached to the new primary (the old primary may be
  rebuilt as the new standby). See `replica-lag.md` if lag is high post-failover.
- Verify backups/PITR are running against the new primary.
- Run a quick integrity check on critical invariants:

  ```sql
  -- No overlapping APPROVED bookings should ever exist (BR5, excl_booking_overlap).
  -- This should return zero rows.
  SELECT a.id, b.id
  FROM bookings a
  JOIN bookings b
    ON a.room_id = b.room_id
   AND a.id < b.id
   AND a.status = 'approved' AND b.status = 'approved'
   AND a.period && b.period;
  ```

## 6. Verify recovery

- `/readyz` 200 across all API pods; error-rate burn stopped.
- Writes succeed (create/approve a test booking in staging-equivalent flow).
- Connection saturation back to baseline; replica re-attached and caught up.

## Prevention

- Keep Multi-AZ enabled (Terraform `multi_az = true`).
- Always connect via the managed endpoint DNS, never a pinned IP.
- Test failover behaviour during the quarterly DR drill
  (`restore-from-backup-drill.md`).
