-- Booking validation invariants must only constrain LIVE bookings.
--
-- The previous fn_validate_booking() (00009) ran the multi-day and capacity
-- checks on every INSERT *and* UPDATE regardless of the resulting status. That
-- meant a booking which no longer satisfies an invariant (e.g. attendees now
-- exceed the room capacity, or the start time has elapsed) could not be moved
-- to a terminal state: an officer's REJECT, a requester's CANCEL, and the
-- expiry sweep's EXPIRE all failed with ATTENDEES_EXCEED_CAPACITY / BOOKING_*.
--
-- Fix: the invariants only describe a *live* (PENDING/APPROVED) booking, so
-- short-circuit and accept any transition into a terminal status
-- (REJECTED/CANCELLED/EXPIRED) without re-validating. Creation is still blocked
-- (a new row is PENDING, so a past/over-capacity insert still raises), and
-- approval still runs every check.

-- +goose Up
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
  -- Invariants below describe a live booking only. Terminal transitions
  -- (REJECTED/CANCELLED/EXPIRED) must never be blocked, so accept them as-is.
  IF NEW.status NOT IN ('PENDING','APPROVED') THEN
    RETURN NEW;
  END IF;

  -- BR3: not in the past.
  IF NEW.starts_at < now() THEN
    RAISE EXCEPTION 'BOOKING_IN_PAST';
  END IF;

  -- Single local day.
  IF (NEW.starts_at AT TIME ZONE v_tz)::date <> (NEW.ends_at AT TIME ZONE v_tz)::date THEN
    RAISE EXCEPTION 'BOOKING_SPANS_MULTIPLE_DAYS';
  END IF;

  -- BR4: capacity.
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
-- Restore the 00009 form: multi-day and capacity checks run for every status.
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
  v_range     tstzrange;
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
    v_range := tstzrange(NEW.starts_at, NEW.ends_at, '[)');

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
    WHERE mw.room_id = NEW.room_id AND mw.during && v_range;
    IF v_hits > 0 THEN
      RAISE EXCEPTION 'CONFLICTS_WITH_MAINTENANCE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
