-- +goose Up
-- Booking & maintenance tables — ad-hoc occupancy, concrete (§6.6).
-- THE double-booking guarantee lives here, in the database.

CREATE TABLE bookings (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  requested_by   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose        text NOT NULL,
  attendee_count int  NOT NULL CHECK (attendee_count > 0),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  status         booking_status NOT NULL DEFAULT 'PENDING',
  reviewed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note    text,
  reviewed_at    timestamptz,
  cancelled_at   timestamptz,
  during         tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_bookings_room      ON bookings(room_id);
CREATE INDEX idx_bookings_requester ON bookings(requested_by);
CREATE INDEX idx_bookings_status    ON bookings(status);
CREATE INDEX idx_bookings_during    ON bookings USING gist (during);

-- THE GUARANTEE: two APPROVED bookings for the same room cannot overlap.
-- Partial constraint => PENDING requests do NOT reserve the room (BR5).
ALTER TABLE bookings
  ADD CONSTRAINT excl_booking_overlap
  EXCLUDE USING gist (room_id WITH =, during WITH &&)
  WHERE (status = 'APPROVED');

CREATE TABLE maintenance_windows (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  during     tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_maint_room   ON maintenance_windows(room_id);
CREATE INDEX idx_maint_during ON maintenance_windows USING gist (during);
ALTER TABLE maintenance_windows
  ADD CONSTRAINT excl_maint_overlap
  EXCLUDE USING gist (room_id WITH =, during WITH &&);

-- Booking validation trigger — defence-in-depth (§6.7).
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION fn_validate_booking() RETURNS trigger AS $$
DECLARE
  v_tz        text := coalesce(current_setting('app.institution_tz', true), 'Africa/Accra');
  v_cap       int;
  v_dow       int;     -- 0=Sun .. 6=Sat
  v_day       day_of_week;
  v_local_d   date;
  v_local_s   time;
  v_local_e   time;
  v_hits      int;
BEGIN
  -- BR3: not in the past (only enforced for live states)
  IF NEW.status IN ('PENDING','APPROVED') AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'BOOKING_IN_PAST';
  END IF;

  -- Single local day
  IF (NEW.starts_at AT TIME ZONE v_tz)::date <> (NEW.ends_at AT TIME ZONE v_tz)::date THEN
    RAISE EXCEPTION 'BOOKING_SPANS_MULTIPLE_DAYS';
  END IF;

  -- BR4: capacity
  SELECT capacity INTO v_cap FROM rooms WHERE id = NEW.room_id;
  IF NEW.attendee_count > v_cap THEN
    RAISE EXCEPTION 'ATTENDEES_EXCEED_CAPACITY';
  END IF;

  -- Hard conflicts only matter when the row is (becoming) APPROVED.
  IF NEW.status = 'APPROVED' THEN
    v_local_d := (NEW.starts_at AT TIME ZONE v_tz)::date;
    v_local_s := (NEW.starts_at AT TIME ZONE v_tz)::time;
    v_local_e := (NEW.ends_at   AT TIME ZONE v_tz)::time;
    v_dow := extract(dow from v_local_d);
    v_day := (ARRAY['SUN','MON','TUE','WED','THU','FRI','SAT'])[v_dow + 1]::day_of_week;

    -- BR1: lecture precedence (active semester, matching weekday, overlapping time)
    SELECT count(*) INTO v_hits
    FROM timetable_events te
    JOIN semesters s ON s.id = te.semester_id AND s.status = 'ACTIVE'
    WHERE te.room_id = NEW.room_id
      AND te.day = v_day
      AND v_local_d BETWEEN s.start_date AND s.end_date
      AND timerange(te.start_time, te.end_time, '[)') && timerange(v_local_s, v_local_e, '[)');
    IF v_hits > 0 THEN
      RAISE EXCEPTION 'CONFLICTS_WITH_LECTURE';
    END IF;

    -- Maintenance overlap
    SELECT count(*) INTO v_hits
    FROM maintenance_windows mw
    WHERE mw.room_id = NEW.room_id AND mw.during && NEW.during;
    IF v_hits > 0 THEN
      RAISE EXCEPTION 'CONFLICTS_WITH_MAINTENANCE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_validate_booking
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_validate_booking();

-- +goose Down
DROP TRIGGER IF EXISTS trg_validate_booking ON bookings;
DROP FUNCTION IF EXISTS fn_validate_booking();
ALTER TABLE maintenance_windows DROP CONSTRAINT IF EXISTS excl_maint_overlap;
DROP TABLE IF EXISTS maintenance_windows;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS excl_booking_overlap;
DROP TABLE IF EXISTS bookings;
