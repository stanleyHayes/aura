# Runbook: restore-from-backup drill (and real recovery)

Run the **quarterly** restore drill and serve as the procedure for a **real**
data-loss recovery (§18.3). Validates that backups are restorable and that the
team can meet the RPO/RTO targets.

## Targets (§18.3)

- **RPO** (max data loss): ≤ 24 h; ≤ 15 min with PITR.
- **RTO** (max time to restore): document the measured value each drill and track
  it against the institution's agreed target.
- Backups are **encrypted**; restores are **tested quarterly**.

## Backup inventory

| Data store | Backup mechanism | Recovery method |
|---|---|---|
| PostgreSQL 18 | Daily full + continuous WAL/PITR (Terraform `backup_retention_period`) | PITR / restore-to-timestamp into a NEW instance. |
| Object storage (S3) | Bucket versioning + lifecycle | Restore prior object versions. |
| Secrets | Secret manager (versioned) | Re-sync via ExternalSecret. |

## Drill cadence and scope

- **Quarterly**, in a **non-production** account/VPC. Never restore over a live
  primary. Schedule a window and notify stakeholders it is a drill.

## Part A — PostgreSQL PITR restore

1. **Pick a target time** within the retention window (for a drill, "now − 1 h").

2. **Restore to a NEW instance** (never in place). Using Terraform, drive a
   point-in-time restore into an isolated instance (or use the managed
   console/CLI for an ad-hoc drill target):

   ```sh
   # Drill: restore-to-point-in-time into a throwaway instance, then validate.
   # (Console/CLI is acceptable for the drill; codify for real DR.)
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier cbs-production-pg-primary \
     --target-db-instance-identifier cbs-drill-restore \
     --restore-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
     --no-multi-az
   ```

3. **Wait** for the restored instance to become available; capture its endpoint.

4. **Validate integrity** against the restored DB:

   ```sql
   -- Schema/migration version present.
   SELECT version_id, is_applied, tstamp
   FROM goose_db_version ORDER BY id DESC LIMIT 5;

   -- Spot-check row counts vs expectations.
   SELECT
     (SELECT count(*) FROM rooms)                 AS rooms,
     (SELECT count(*) FROM bookings)              AS bookings,
     (SELECT count(*) FROM lecture_occupancies)   AS lectures;

   -- Critical invariant: no overlapping APPROVED bookings (BR5). Expect 0 rows.
   SELECT a.id, b.id
   FROM bookings a JOIN bookings b
     ON a.room_id = b.room_id AND a.id < b.id
    AND a.status='approved' AND b.status='approved'
    AND a.period && b.period;
   ```

5. **Measure** elapsed time from decision to validated-restore → record as RTO.
   Note the achieved RPO (restore time vs target time).

6. **Tear down** the drill instance:

   ```sh
   aws rds delete-db-instance \
     --db-instance-identifier cbs-drill-restore \
     --skip-final-snapshot --delete-automated-backups
   ```

## Part B — Object storage version restore

1. Confirm versioning is enabled (it is, via Terraform `object_storage`).
2. Restore a prior version of a known test object:

   ```sh
   aws s3api list-object-versions --bucket "$BUCKET" --prefix "drill/test.txt"
   aws s3api copy-object --bucket "$BUCKET" --key "drill/test.txt" \
     --copy-source "$BUCKET/drill/test.txt?versionId=<PRIOR_VERSION_ID>"
   ```

3. Verify the restored content matches the expected prior state.

## Part C — Real recovery (production data loss)

Differences from the drill:

1. **Declare a Sev-1 incident**; communicate scope and ETA.
2. Restore PITR to a **new** instance as in Part A, choosing the latest safe
   point before the corruption/loss.
3. **Cut the application over** to the restored instance:
   - Update `DATABASE_URL` in the secret manager to the restored endpoint.
   - Force `ExternalSecret` resync and roll pods (see `secret-rotation.md`).
   - Validate `/readyz` and the BR5 invariant before reopening writes.
4. Re-establish a replica and confirm backups/PITR run against the new primary.
5. Post-incident: document timeline, root cause, achieved RPO/RTO, follow-ups.

## Verify drill success

- Restore completed within the RTO target; RPO within target.
- Integrity checks passed (migration version, row counts, BR5 invariant = 0).
- Object-version restore verified.
- Drill instance/resources torn down (no lingering cost).
- Results recorded (date, RTO, RPO, issues) and any gaps ticketed.

## If a drill fails

- A failed restore is a Sev-2: backups not meeting their purpose. Treat urgently
  — investigate retention config, encryption keys, and IAM permissions for
  restore. Re-drill after the fix.
