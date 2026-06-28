-- ── Refresh tokens (opaque, hashed, rotated; §9.1) ────────────
-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, family_id, user_agent, ip_address, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens WHERE token_hash = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshFamily :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL;

-- name: RevokeAllUserRefreshTokens :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL;

-- ── Password reset tokens ─────────────────────────────────────
-- name: CreatePasswordResetToken :one
INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPasswordResetToken :one
SELECT * FROM password_reset_tokens WHERE token_hash = $1;

-- name: ConsumePasswordResetToken :exec
UPDATE password_reset_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL;

-- ── Idempotency keys (§8.1) ───────────────────────────────────
-- name: GetIdempotencyKey :one
SELECT * FROM idempotency_keys WHERE user_id = $1 AND idem_key = $2;

-- name: PutIdempotencyKey :one
INSERT INTO idempotency_keys (user_id, idem_key, request_hash, status_code, response_body, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, idem_key) DO NOTHING
RETURNING *;

-- name: DeleteExpiredIdempotencyKeys :exec
DELETE FROM idempotency_keys WHERE expires_at < now();
