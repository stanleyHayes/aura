-- ── Buildings ─────────────────────────────────────────────────
-- name: CreateBuilding :one
INSERT INTO buildings (code, name, campus) VALUES ($1, $2, $3) RETURNING *;

-- name: GetBuilding :one
SELECT * FROM buildings WHERE id = $1;

-- name: ListBuildings :many
SELECT * FROM buildings ORDER BY code;

-- name: UpdateBuilding :one
UPDATE buildings SET code = $2, name = $3, campus = $4, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: DeleteBuilding :exec
DELETE FROM buildings WHERE id = $1;

-- ── Equipment ─────────────────────────────────────────────────
-- name: CreateEquipment :one
INSERT INTO equipment (code, name) VALUES ($1, $2) RETURNING *;

-- name: GetEquipment :one
SELECT * FROM equipment WHERE id = $1;

-- name: ListEquipment :many
SELECT * FROM equipment ORDER BY code;

-- name: UpdateEquipment :one
UPDATE equipment SET code = $2, name = $3 WHERE id = $1 RETURNING *;

-- name: DeleteEquipment :exec
DELETE FROM equipment WHERE id = $1;

-- ── Rooms ─────────────────────────────────────────────────────
-- name: CreateRoom :one
INSERT INTO rooms (room_code, name, building_id, capacity, room_type, status)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: GetRoom :one
SELECT * FROM rooms WHERE id = $1;

-- name: GetRoomByCode :one
SELECT * FROM rooms WHERE room_code = $1;

-- name: UpdateRoom :one
UPDATE rooms SET room_code = $2, name = $3, building_id = $4, capacity = $5,
                 room_type = $6, status = $7, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: SetRoomStatus :one
UPDATE rooms SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: ListRoomEquipment :many
SELECT re.equipment_id, e.code, e.name, re.quantity
FROM room_equipment re JOIN equipment e ON e.id = re.equipment_id
WHERE re.room_id = $1
ORDER BY e.code;

-- name: ClearRoomEquipment :exec
DELETE FROM room_equipment WHERE room_id = $1;

-- name: AddRoomEquipment :exec
INSERT INTO room_equipment (room_id, equipment_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (room_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity;
