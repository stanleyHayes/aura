-- +goose Up
-- Make audit_logs append-only at the database (§6.9, §14 A09). The spec calls for
-- granting the app role INSERT,SELECT only; we additionally enforce it with a
-- trigger so the invariant holds regardless of the connecting role (defence in
-- depth) — UPDATE and DELETE on audit_logs raise an exception.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION fn_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IS_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_append_only();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_append_only();

-- Production: also grant least privilege to the application role, e.g.
--   REVOKE UPDATE, DELETE ON audit_logs FROM app_role;
--   GRANT INSERT, SELECT ON audit_logs TO app_role;
-- (kept as documentation; the trigger is the portable guarantee.)

-- +goose Down
DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
DROP FUNCTION IF EXISTS fn_audit_logs_append_only();
