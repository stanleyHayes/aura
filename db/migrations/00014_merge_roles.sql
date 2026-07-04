-- Collapse the four-role model into three (stakeholder feedback):
--   SYSTEM_ADMIN                     -> SUPER_ADMIN
--   TIMETABLE_ADMIN + BOOKING_OFFICER -> ADMIN   (timetable + approvals + reports)
--   REQUESTER                        -> REQUESTER (unchanged)
--
-- Postgres cannot DROP enum values, so swap the `user_role` type wholesale and
-- remap every existing users.role in the USING clause. Creating a brand-new
-- type and using its values is fine within one transaction (unlike
-- `ALTER TYPE ... ADD VALUE`), so goose's default per-migration tx is safe.

-- +goose Up
CREATE TYPE user_role_new AS ENUM ('SUPER_ADMIN', 'ADMIN', 'REQUESTER');

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING (
    CASE role::text
      WHEN 'SYSTEM_ADMIN'    THEN 'SUPER_ADMIN'
      WHEN 'TIMETABLE_ADMIN' THEN 'ADMIN'
      WHEN 'BOOKING_OFFICER' THEN 'ADMIN'
      ELSE 'REQUESTER'
    END
  )::user_role_new;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'REQUESTER';

DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- +goose Down
-- Lossy: the merge is not reversible per-row, so ADMIN collapses to
-- BOOKING_OFFICER (the approvals half). SUPER_ADMIN -> SYSTEM_ADMIN.
CREATE TYPE user_role_old AS ENUM ('SYSTEM_ADMIN', 'TIMETABLE_ADMIN', 'BOOKING_OFFICER', 'REQUESTER');

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE user_role_old
  USING (
    CASE role::text
      WHEN 'SUPER_ADMIN' THEN 'SYSTEM_ADMIN'
      WHEN 'ADMIN'       THEN 'BOOKING_OFFICER'
      ELSE 'REQUESTER'
    END
  )::user_role_old;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'REQUESTER';

DROP TYPE user_role;
ALTER TYPE user_role_old RENAME TO user_role;
