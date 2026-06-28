-- ── Semesters ─────────────────────────────────────────────────
-- name: CreateSemester :one
INSERT INTO semesters (name, start_date, end_date, status)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetSemester :one
SELECT * FROM semesters WHERE id = $1;

-- name: GetActiveSemester :one
SELECT * FROM semesters WHERE status = 'ACTIVE';

-- name: ListSemesters :many
SELECT * FROM semesters ORDER BY start_date DESC;

-- name: UpdateSemester :one
UPDATE semesters SET name = $2, start_date = $3, end_date = $4, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: SetSemesterStatus :one
UPDATE semesters SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteSemester :exec
DELETE FROM semesters WHERE id = $1;

-- ── Courses ───────────────────────────────────────────────────
-- name: UpsertCourse :one
INSERT INTO courses (course_code, title, department_id)
VALUES ($1, $2, $3)
ON CONFLICT (course_code) DO UPDATE SET title = EXCLUDED.title
RETURNING *;

-- name: ListCourses :many
SELECT * FROM courses ORDER BY course_code;

-- ── Timetable imports ─────────────────────────────────────────
-- name: CreateTimetableImport :one
INSERT INTO timetable_imports (semester_id, uploaded_by, method, file_object_key, status)
VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *;

-- name: GetTimetableImport :one
SELECT * FROM timetable_imports WHERE id = $1;

-- name: UpdateImportProgress :one
UPDATE timetable_imports
SET status = $2, total_rows = $3, imported_rows = $4, error_rows = $5,
    error_report = $6, completed_at = $7
WHERE id = $1 RETURNING *;

-- ── Timetable events ──────────────────────────────────────────
-- name: CreateTimetableEvent :one
INSERT INTO timetable_events
  (semester_id, import_id, room_id, course_code, course_title, lecturer_name, day, start_time, end_time)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetTimetableEvent :one
SELECT * FROM timetable_events WHERE id = $1;

-- name: UpdateTimetableEvent :one
UPDATE timetable_events
SET room_id = $2, course_code = $3, course_title = $4, lecturer_name = $5,
    day = $6, start_time = $7, end_time = $8
WHERE id = $1 RETURNING *;

-- name: DeleteTimetableEvent :exec
DELETE FROM timetable_events WHERE id = $1;

-- name: DeleteSemesterEvents :exec
DELETE FROM timetable_events WHERE semester_id = $1;

-- name: ListTimetableEvents :many
SELECT * FROM timetable_events
WHERE (sqlc.narg('semester_id')::uuid IS NULL OR semester_id = sqlc.narg('semester_id'))
  AND (sqlc.narg('room_id')::uuid IS NULL OR room_id = sqlc.narg('room_id'))
  AND (sqlc.narg('day')::day_of_week IS NULL OR day = sqlc.narg('day'))
ORDER BY day, start_time;

-- name: ListRoomLecturesOnDay :many
-- Active-semester lectures for a room on a given weekday, where the date falls
-- inside the semester window. Used by the availability engine (§7.1, BR1/BR2).
SELECT te.id, te.course_code, te.course_title, te.lecturer_name,
       te.day, te.start_time, te.end_time
FROM timetable_events te
JOIN semesters s ON s.id = te.semester_id AND s.status = 'ACTIVE'
WHERE te.room_id = $1
  AND te.day = $2
  AND sqlc.arg('on_date')::date BETWEEN s.start_date AND s.end_date
ORDER BY te.start_time;
