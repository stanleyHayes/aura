-- +goose Up
-- Reference & identity tables (§6.3).

CREATE TABLE departments (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  faculty    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  email                 citext NOT NULL UNIQUE,
  password_hash         text NOT NULL,                 -- Argon2id encoded string
  full_name             text NOT NULL,
  role                  user_role NOT NULL DEFAULT 'REQUESTER',
  department_id         uuid REFERENCES departments(id) ON DELETE SET NULL,
  status                user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  mfa_enabled           boolean NOT NULL DEFAULT false,
  mfa_secret_encrypted  bytea,                         -- AES-GCM, app-encrypted
  failed_login_attempts int NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,                     -- SHA-256 of opaque token; raw never stored
  family_id  uuid NOT NULL,                            -- rotation family for reuse detection (§9.1)
  user_agent text,
  ip_address text,                                     -- client IP (text; see ADR-0003)
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
