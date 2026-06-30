-- ── Maintenance windows (§6.6) ────────────────────────────────
-- name: CreateMaintenanceWindow :one
INSERT INTO maintenance_windows (room_id, starts_at, ends_at, reason, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, room_id, starts_at, ends_at, reason, created_by, created_at;

-- name: GetMaintenanceWindow :one
SELECT id, room_id, starts_at, ends_at, reason, created_by, created_at
FROM maintenance_windows WHERE id = $1;

-- name: ListMaintenanceWindows :many
SELECT id, room_id, starts_at, ends_at, reason, created_by, created_at
FROM maintenance_windows
WHERE (sqlc.narg('room_id')::uuid IS NULL OR room_id = sqlc.narg('room_id'))
ORDER BY starts_at DESC;

-- name: DeleteMaintenanceWindow :exec
DELETE FROM maintenance_windows WHERE id = $1;

-- name: ListMaintenanceForRoomInRange :many
-- Maintenance overlapping [day_start, day_end). Availability (§7.1).
SELECT id, room_id, starts_at, ends_at, reason, created_by, created_at
FROM maintenance_windows
WHERE room_id = $1
  AND during && tstzrange(sqlc.arg('day_start')::timestamptz, sqlc.arg('day_end')::timestamptz, '[)')
ORDER BY starts_at;

-- ── Notifications (§6.8) ───────────────────────────────────────
-- name: CreateNotification :one
INSERT INTO notifications (user_id, channel, type, title, body, related_entity_type, related_entity_id, sent_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
  AND (sqlc.arg('unread_only')::boolean = false OR read_at IS NULL)
  AND (sqlc.narg('cursor')::uuid IS NULL OR id < sqlc.narg('cursor'))
ORDER BY id DESC
LIMIT sqlc.arg('lim');

-- name: MarkNotificationRead :exec
UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL;

-- name: CountUnread :one
SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL;

-- ── Push devices (§13) ────────────────────────────────────────
-- name: RegisterPushDevice :one
INSERT INTO push_devices (user_id, expo_token, platform)
VALUES ($1, $2, $3)
ON CONFLICT (expo_token) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen_at = now()
RETURNING *;

-- name: ListUserPushTokens :many
SELECT expo_token FROM push_devices WHERE user_id = $1;

-- ── Audit log (append-only; §6.9) ─────────────────────────────
-- name: InsertAuditLog :exec
INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes, ip_address, user_agent)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: ListAuditLogs :many
SELECT
  audit_logs.id,
  audit_logs.actor_id,
  users.full_name AS actor_name,
  audit_logs.action,
  audit_logs.entity_type,
  audit_logs.entity_id,
  audit_logs.changes,
  audit_logs.ip_address,
  audit_logs.user_agent,
  audit_logs.created_at
FROM audit_logs
LEFT JOIN users ON users.id = audit_logs.actor_id
WHERE (sqlc.narg('actor_id')::uuid IS NULL OR audit_logs.actor_id = sqlc.narg('actor_id'))
  AND (sqlc.narg('entity_type')::text IS NULL OR audit_logs.entity_type = sqlc.narg('entity_type'))
  AND (sqlc.narg('entity_id')::uuid IS NULL OR audit_logs.entity_id = sqlc.narg('entity_id'))
  AND (sqlc.narg('action')::text IS NULL OR audit_logs.action = sqlc.narg('action'))
  AND (sqlc.narg('cursor')::uuid IS NULL OR audit_logs.id < sqlc.narg('cursor'))
ORDER BY audit_logs.id DESC
LIMIT sqlc.arg('lim');
