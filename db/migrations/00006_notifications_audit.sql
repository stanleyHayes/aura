-- +goose Up
-- Notifications (§6.8), audit log (§6.9), push devices and idempotency keys (§8.1).

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel             notif_channel NOT NULL,
  type                text NOT NULL,   -- BOOKING_SUBMITTED|APPROVED|REJECTED|CANCELLED|REMINDER
  title               text NOT NULL,
  body                text NOT NULL,
  related_entity_type text,
  related_entity_id   uuid,
  read_at             timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notif_user_all    ON notifications(user_id, created_at DESC);

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,   -- CREATE|UPDATE|DELETE|APPROVE|REJECT|OVERRIDE|LOGIN|LOGIN_FAILED|...
  entity_type text NOT NULL,
  entity_id   uuid,
  changes     jsonb,           -- {"before":{...},"after":{...}}
  ip_address  text,            -- client IP (text; see ADR-0003)
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor   ON audit_logs(actor_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Expo push device registrations (§8.3 POST /devices, §13).
CREATE TABLE push_devices (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_token  text NOT NULL UNIQUE,
  platform    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_devices_user ON push_devices(user_id);

-- Idempotency-Key storage (§8.1): key -> stored response, replayed for 24h.
CREATE TABLE idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idem_key      text NOT NULL,
  request_hash  text NOT NULL,
  status_code   int NOT NULL,
  response_body jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  UNIQUE (user_id, idem_key)
);
CREATE INDEX idx_idem_expires ON idempotency_keys(expires_at);

-- +goose Down
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS push_devices;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
