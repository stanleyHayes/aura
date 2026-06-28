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
