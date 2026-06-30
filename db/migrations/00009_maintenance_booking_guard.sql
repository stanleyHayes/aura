-- +goose Up
-- LOW-12: make the maintenance/booking invariant bidirectional.
--
-- Submitting a booking already rejects overlap with an existing maintenance
-- window (fn_validate_booking, migration 00005), but creating a maintenance
-- window did NOT reject an overlapping APPROVED booking. This trigger closes that
-- gap symmetrically: a maintenance window cannot be created or moved onto a room
-- while an APPROVED booking overlaps the same time range.

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION fn_validate_maintenance() RETURNS trigger AS $$
DECLARE
  v_hits int;
  v_range tstzrange;
BEGIN
  -- NEW.during is a STORED generated column and is NOT yet populated inside a
  -- BEFORE trigger, so build the range explicitly from the start/end columns.
  v_range := tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  SELECT count(*) INTO v_hits
  FROM bookings b
  WHERE b.room_id = NEW.room_id
    AND b.status = 'APPROVED'
    AND b.during && v_range;
  IF v_hits > 0 THEN
    RAISE EXCEPTION 'CONFLICTS_WITH_APPROVED_BOOKING';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_validate_maintenance
  BEFORE INSERT OR UPDATE ON maintenance_windows
  FOR EACH ROW EXECUTE FUNCTION fn_validate_maintenance();

-- Companion fix: fn_validate_booking (migration 00005) compared mw.during against
-- NEW.during, but NEW.during (a STORED generated column) is NULL inside a BEFORE
-- trigger, so the booking→maintenance check on APPROVE never matched. Recreate the
-- function building the range explicitly from NEW.starts_at/NEW.ends_at so the
-- guarantee holds on the booking side too. Body is otherwise identical to 00005.
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
  v_range     tstzrange;
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
    v_range := tstzrange(NEW.starts_at, NEW.ends_at, '[)');

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

    -- Maintenance overlap (use the explicit range; NEW.during is NULL here).
    SELECT count(*) INTO v_hits
    FROM maintenance_windows mw
    WHERE mw.room_id = NEW.room_id AND mw.during && v_range;
    IF v_hits > 0 THEN
      RAISE EXCEPTION 'CONFLICTS_WITH_MAINTENANCE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose Down
-- Restore the original (NEW.during) form of fn_validate_booking from 00005.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION fn_validate_booking() RETURNS trigger AS $$
DECLARE
  v_tz        text := coalesce(current_setting('app.institution_tz', true), 'Africa/Accra');
  v_cap       int;
  v_dow       int;
  v_day       day_of_week;
  v_local_d   date;
  v_local_s   time;
  v_local_e   time;
  v_hits      int;
BEGIN
  IF NEW.status IN ('PENDING','APPROVED') AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'BOOKING_IN_PAST';
  END IF;
  IF (NEW.starts_at AT TIME ZONE v_tz)::date <> (NEW.ends_at AT TIME ZONE v_tz)::date THEN
    RAISE EXCEPTION 'BOOKING_SPANS_MULTIPLE_DAYS';
  END IF;
  SELECT capacity INTO v_cap FROM rooms WHERE id = NEW.room_id;
  IF NEW.attendee_count > v_cap THEN
    RAISE EXCEPTION 'ATTENDEES_EXCEED_CAPACITY';
  END IF;
  IF NEW.status = 'APPROVED' THEN
    v_local_d := (NEW.starts_at AT TIME ZONE v_tz)::date;
    v_local_s := (NEW.starts_at AT TIME ZONE v_tz)::time;
    v_local_e := (NEW.ends_at   AT TIME ZONE v_tz)::time;
    v_dow := extract(dow from v_local_d);
    v_day := (ARRAY['SUN','MON','TUE','WED','THU','FRI','SAT'])[v_dow + 1]::day_of_week;
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

DROP TRIGGER IF EXISTS trg_validate_maintenance ON maintenance_windows;
DROP FUNCTION IF EXISTS fn_validate_maintenance();
