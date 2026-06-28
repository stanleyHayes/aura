-- +goose Up
-- Scheduling tables — lecture occupancy, recurring (§6.5).

CREATE TABLE semesters (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  status     semester_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
-- At most one ACTIVE semester (BR2). Partial unique index on an immutable constant.
CREATE UNIQUE INDEX uq_one_active_semester ON semesters ((true)) WHERE status = 'ACTIVE';

CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  course_code   text NOT NULL UNIQUE,
  title         text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timetable_imports (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  semester_id     uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  method          import_method NOT NULL,
  file_object_key text,                       -- S3 key of the original upload
  status          import_status NOT NULL DEFAULT 'PENDING',
  total_rows      int NOT NULL DEFAULT 0,
  imported_rows   int NOT NULL DEFAULT 0,
  error_rows      int NOT NULL DEFAULT 0,
  error_report    jsonb,                       -- [{row, field, message}]
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX idx_tt_imports_semester ON timetable_imports(semester_id);

CREATE TABLE timetable_events (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  semester_id   uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  import_id     uuid REFERENCES timetable_imports(id) ON DELETE SET NULL,
  room_id       uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  course_code   text NOT NULL,
  course_title  text NOT NULL,
  lecturer_name text NOT NULL,
  day           day_of_week NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_tt_events_room_day ON timetable_events(room_id, day);
CREATE INDEX idx_tt_events_semester ON timetable_events(semester_id);

-- No two lectures may overlap in the same room/day within one semester.
ALTER TABLE timetable_events
  ADD CONSTRAINT excl_tt_overlap
  EXCLUDE USING gist (
    room_id     WITH =,
    semester_id WITH =,
    day         WITH =,
    timerange(start_time, end_time, '[)') WITH &&
  );

-- +goose Down
ALTER TABLE timetable_events DROP CONSTRAINT IF EXISTS excl_tt_overlap;
DROP TABLE IF EXISTS timetable_events;
DROP TABLE IF EXISTS timetable_imports;
DROP TABLE IF EXISTS courses;
DROP INDEX IF EXISTS uq_one_active_semester;
DROP TABLE IF EXISTS semesters;
