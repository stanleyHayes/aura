# Runbook: failed timetable-import recovery

Recover from a failed or partially-applied timetable import (FR4, §7.5). Imports
are parsed and applied by the **worker** as a River job; progress and outcome are
tracked in the `timetable_imports` table.

## Symptoms

- An admin reports an upload stuck at "processing" or showing an error.
- Alert: job-queue backlog (`stuck-job-queue.md`) with import jobs failing.
- A `timetable_imports` row in status `failed` or long-stuck in `processing`.
- Derived occupancy (FR5) missing/wrong for the affected semester.

## 1. Identify the import

```sql
-- Most recent imports and their state.
SELECT id, semester_id, status, filename, rows_total, rows_imported,
       error_summary, created_at, updated_at
FROM timetable_imports
ORDER BY created_at DESC
LIMIT 20;
```

Note the `id`, `semester_id`, and `status`. Pull the worker logs for that import:

```sh
kubectl -n "$NS" logs deploy/cbs-worker --since=2h | grep -i "import_id=<ID>"
```

Cross-reference Sentry for the stack trace and Tempo for the trace.

## 2. Classify the failure

| Class | Signature | Likely cause |
|---|---|---|
| Parse/validation | `error_summary` cites a row/column; `rows_imported = 0` | Bad file: wrong columns, unexpected MIME, formulas/macros (rejected per §14). |
| Partial apply | `0 < rows_imported < rows_total`, status `failed` | Worker crashed mid-batch, or a row violated a DB invariant (§6.7 trigger). |
| Stuck processing | status `processing`, no progress, job not running | Worker crash-loop or lost job — see `stuck-job-queue.md`. |
| Conflict on occupancy | trigger rejected a lecture overlap (BR1) | Source timetable double-books a room. |

## 3. Recover

Imports are designed to be **idempotent per semester**: applying lecture
occupancy is transactional and keyed so a re-run replaces, not duplicates.

### Parse/validation failure (bad file)

1. No data was written. Ask the admin to fix the file (correct columns, remove
   formulas, valid xlsx/csv) and re-upload.
2. Confirm the new import reaches `completed`.

### Partial apply / stuck processing

1. Confirm whether the apply transaction committed:

   ```sql
   SELECT count(*) FROM lecture_occupancies WHERE semester_id = '<SEMESTER_ID>';
   ```

2. Because the apply step runs in a single transaction per import, a crash should
   have rolled back. If partial rows exist (e.g. an older import design), clear
   the derived occupancy for that import and re-run:

   ```sql
   -- DANGER: scope strictly to the failed import/semester. Run inside a tx and
   -- verify the row count BEFORE committing.
   BEGIN;
   DELETE FROM lecture_occupancies
   WHERE semester_id = '<SEMESTER_ID>' AND import_id = '<IMPORT_ID>';
   -- verify, then COMMIT or ROLLBACK.
   COMMIT;
   ```

3. Re-enqueue the import (admin re-triggers, or re-enqueue the River job by
   `id`). Verify it reaches `completed` and occupancy is correct.

### Occupancy conflict (source double-books a room)

1. The §6.7 trigger correctly refused conflicting lecture occupancy. This is a
   data problem in the source timetable, not a bug.
2. Surface the conflicting rows to the admin (the import error should name them);
   they must resolve the clash in the source and re-upload.

## 4. Verify recovery

- `timetable_imports` row is `completed` with `rows_imported = rows_total`.
- Availability search (FR6) for the semester reflects the lectures.
- No lingering `failed`/`processing` imports for the semester.
- Import success-rate metric returns to baseline; no new related Sentry errors.

## Prevention

- Validate columns and reject macros/formulas at upload (§14) — keep these checks
  strict.
- Keep apply transactional and idempotent per `(semester_id, import_id)`.
- Alert on import success rate dropping below threshold.
