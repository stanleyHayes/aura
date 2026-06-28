-- +goose Up
-- Extensions and custom types (§6.1). Targets PostgreSQL 18 (uuidv7() built-in),
-- but stays portable to PG 16/17 (e.g. managed Postgres on Render) via a guarded
-- uuidv7() polyfill below — see ADR-0007.

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- exclusion constraints mixing '=' and '&&'
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- fuzzy search on names/codes
CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive email

-- UUIDv7 polyfill: only created when the server lacks the PG18 built-in. Produces
-- a valid, time-ordered v7 UUID using core functions only (gen_random_uuid is
-- built in since PG13). This keeps the time-ordered-id cursor pagination working
-- on Render's managed Postgres (PG16/17) without changing any table definition.
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuidv7') THEN
    CREATE FUNCTION public.uuidv7() RETURNS uuid AS $fn$
      SELECT encode(
        set_bit(
          set_bit(
            overlay(uuid_send(gen_random_uuid())
                    placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                    from 1 for 6),
            52, 1),
          53, 1), 'hex')::uuid;
    $fn$ LANGUAGE sql VOLATILE;
  END IF;
END$$;
-- +goose StatementEnd

-- A range type over time-of-day for recurring lecture overlap constraints.
CREATE TYPE timerange AS RANGE (subtype = time);

CREATE TYPE user_role        AS ENUM ('SYSTEM_ADMIN','TIMETABLE_ADMIN','BOOKING_OFFICER','REQUESTER');
CREATE TYPE user_status      AS ENUM ('ACTIVE','SUSPENDED','PENDING_VERIFICATION');
CREATE TYPE room_type        AS ENUM ('LECTURE_HALL','LAB','SEMINAR_ROOM','AUDITORIUM','CONFERENCE_ROOM');
CREATE TYPE room_status      AS ENUM ('ACTIVE','INACTIVE','UNDER_MAINTENANCE');
CREATE TYPE semester_status  AS ENUM ('DRAFT','ACTIVE','ARCHIVED');
CREATE TYPE day_of_week      AS ENUM ('MON','TUE','WED','THU','FRI','SAT','SUN');
CREATE TYPE booking_status   AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED');
CREATE TYPE import_method    AS ENUM ('EXCEL','CSV','MANUAL');
CREATE TYPE import_status    AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','PARTIALLY_COMPLETED');
CREATE TYPE notif_channel    AS ENUM ('EMAIL','IN_APP','PUSH');

-- +goose Down
DROP TYPE IF EXISTS notif_channel;
DROP TYPE IF EXISTS import_status;
DROP TYPE IF EXISTS import_method;
DROP TYPE IF EXISTS booking_status;
DROP TYPE IF EXISTS day_of_week;
DROP TYPE IF EXISTS semester_status;
DROP TYPE IF EXISTS room_status;
DROP TYPE IF EXISTS room_type;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS timerange;
DROP FUNCTION IF EXISTS public.uuidv7();
DROP EXTENSION IF EXISTS citext;
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS btree_gist;
