-- Booking queries. We never SELECT the generated `during` column (a tstzrange);
-- the partial EXCLUDE constraint and the validation trigger are the guarantees.

-- name: CreateBooking :one
INSERT INTO bookings (room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status)
VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
RETURNING id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status,
          reviewed_by, review_note, reviewed_at, cancelled_at, created_at, updated_at;

-- name: GetBooking :one
SELECT id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status,
       reviewed_by, review_note, reviewed_at, cancelled_at, created_at, updated_at
FROM bookings WHERE id = $1;

-- name: GetBookingForUpdate :one
-- Lock the row for the approval re-check (§7.3).
SELECT id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status,
       reviewed_by, review_note, reviewed_at, cancelled_at, created_at, updated_at
FROM bookings WHERE id = $1 FOR UPDATE;

-- name: ListBookings :many
SELECT id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status,
       reviewed_by, review_note, reviewed_at, cancelled_at, created_at, updated_at
FROM bookings
WHERE (sqlc.narg('requester_id')::uuid IS NULL OR requested_by = sqlc.narg('requester_id'))
  AND (sqlc.narg('room_id')::uuid IS NULL OR room_id = sqlc.narg('room_id'))
  AND (sqlc.narg('status')::booking_status IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('from_ts')::timestamptz IS NULL OR starts_at >= sqlc.narg('from_ts'))
  AND (sqlc.narg('to_ts')::timestamptz IS NULL OR starts_at < sqlc.narg('to_ts'))
  AND (sqlc.narg('cursor')::uuid IS NULL OR id < sqlc.narg('cursor'))
ORDER BY id DESC
LIMIT sqlc.arg('lim');

-- name: ListPendingForApproval :many
-- Pending bookings enriched with room + requester (+ department) for the
-- approvals queue (FR8, §11). Joined here so the handler avoids N+1 lookups; the
-- approvability blockers are then computed per row in the service layer.
SELECT b.id, b.room_id, b.requested_by, b.purpose, b.attendee_count,
       b.starts_at, b.ends_at, b.status, b.reviewed_by, b.review_note,
       b.reviewed_at, b.cancelled_at, b.created_at, b.updated_at,
       r.room_code        AS room_code,
       r.name             AS room_name,
       r.capacity         AS room_capacity,
       u.full_name        AS requester_full_name,
       u.department_id    AS requester_department_id,
       d.name             AS requester_department_name
FROM bookings b
JOIN rooms r ON r.id = b.room_id
JOIN users u ON u.id = b.requested_by
LEFT JOIN departments d ON d.id = u.department_id
WHERE b.status = 'PENDING'
  AND (sqlc.narg('room_id')::uuid IS NULL OR b.room_id = sqlc.narg('room_id'))
  AND (sqlc.narg('cursor')::uuid IS NULL OR b.id < sqlc.narg('cursor'))
ORDER BY b.id DESC
LIMIT sqlc.arg('lim');

-- name: SetBookingStatus :one
-- Generic status transition used by approve/reject/cancel/override/expire.
UPDATE bookings
SET status = $2,
    reviewed_by = COALESCE(sqlc.narg('reviewed_by'), reviewed_by),
    review_note = COALESCE(sqlc.narg('review_note'), review_note),
    reviewed_at = CASE WHEN $2 IN ('APPROVED'::booking_status,'REJECTED'::booking_status) THEN now() ELSE reviewed_at END,
    cancelled_at = CASE WHEN $2 = 'CANCELLED'::booking_status THEN now() ELSE cancelled_at END,
    updated_at = now()
WHERE id = $1
RETURNING id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status,
          reviewed_by, review_note, reviewed_at, cancelled_at, created_at, updated_at;

-- name: ExpireStalePending :execrows
-- Set EXPIRED for PENDING bookings whose start time has passed (§7.2).
UPDATE bookings SET status = 'EXPIRED', updated_at = now()
WHERE status = 'PENDING' AND starts_at < now();

-- name: ListApprovedBookingsForRoomInRange :many
-- Approved bookings whose time overlaps [day_start, day_end). Availability (§7.1, BR5).
SELECT id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status
FROM bookings
WHERE room_id = $1
  AND status = 'APPROVED'
  AND during && tstzrange(sqlc.arg('day_start')::timestamptz, sqlc.arg('day_end')::timestamptz, '[)')
ORDER BY starts_at;

-- name: ListConflictingApprovedBookings :many
-- Other approved bookings overlapping the given window for a room (override support, BR6).
SELECT id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status
FROM bookings
WHERE room_id = $1
  AND status = 'APPROVED'
  AND id <> sqlc.arg('exclude_id')
  AND during && tstzrange(sqlc.arg('win_start')::timestamptz, sqlc.arg('win_end')::timestamptz, '[)');

-- name: CountPendingOverlap :one
-- Competing PENDING requests for the same room/window (FR8 surfacing).
SELECT count(*) FROM bookings
WHERE room_id = $1
  AND status = 'PENDING'
  AND id <> sqlc.arg('exclude_id')
  AND during && tstzrange(sqlc.arg('win_start')::timestamptz, sqlc.arg('win_end')::timestamptz, '[)');
