-- ── Departments ───────────────────────────────────────────────
-- name: CreateDepartment :one
INSERT INTO departments (code, name, faculty)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetDepartment :one
SELECT * FROM departments WHERE id = $1;

-- name: ListDepartments :many
SELECT * FROM departments ORDER BY code;

-- name: UpdateDepartment :one
UPDATE departments SET code = $2, name = $3, faculty = $4, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: DeleteDepartment :exec
DELETE FROM departments WHERE id = $1;

-- ── Users ─────────────────────────────────────────────────────
-- name: CreateUser :one
INSERT INTO users (email, password_hash, full_name, role, department_id, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: ListUsers :many
SELECT * FROM users
WHERE (sqlc.narg('role')::user_role IS NULL OR role = sqlc.narg('role'))
  AND (sqlc.narg('department_id')::uuid IS NULL OR department_id = sqlc.narg('department_id'))
  AND (sqlc.narg('status')::user_status IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('cursor')::uuid IS NULL OR id > sqlc.narg('cursor'))
ORDER BY id
LIMIT sqlc.arg('lim');

-- name: UpdateUserProfile :one
UPDATE users SET full_name = $2, department_id = $3, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: UpdateUserRole :one
UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: SetUserStatus :one
UPDATE users SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: UpdatePasswordHash :exec
UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1;

-- name: RecordSuccessfulLogin :exec
UPDATE users
SET last_login_at = now(), failed_login_attempts = 0, locked_until = NULL, updated_at = now()
WHERE id = $1;

-- name: RecordFailedLogin :one
UPDATE users
SET failed_login_attempts = failed_login_attempts + 1,
    locked_until = CASE WHEN failed_login_attempts + 1 >= sqlc.arg('max_attempts')
                        THEN now() + sqlc.arg('lock_window')::interval ELSE locked_until END,
    updated_at = now()
WHERE id = $1
RETURNING failed_login_attempts, locked_until;

-- name: SetMFASecret :exec
UPDATE users SET mfa_secret_encrypted = $2, updated_at = now() WHERE id = $1;

-- name: EnableMFA :exec
UPDATE users SET mfa_enabled = true, updated_at = now() WHERE id = $1;
