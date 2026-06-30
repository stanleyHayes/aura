-- +goose Up
-- Capture the catalogue-relevant columns the real Ashesi timetable export carries
-- (Section, Program, Department) on each lecture event so the importer can build
-- out the catalogue without losing this context (§7.5). Defaults keep existing
-- rows and the manual single-event create path valid.

ALTER TABLE timetable_events
  ADD COLUMN section    text NOT NULL DEFAULT '',
  ADD COLUMN program    text NOT NULL DEFAULT '',
  ADD COLUMN department text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE timetable_events
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS program,
  DROP COLUMN IF EXISTS section;
