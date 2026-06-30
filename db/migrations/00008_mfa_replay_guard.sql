-- +goose Up
-- LOW-8: TOTP replay protection. A valid code is acceptable within a small window
-- (clock skew), so a code can be replayed inside that window. Persisting the last
-- accepted TOTP timestep lets us reject any code whose timestep is <= the last one
-- already used, making each code single-use.
ALTER TABLE users ADD COLUMN last_mfa_timestep bigint;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS last_mfa_timestep;
