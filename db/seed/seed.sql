-- Reference + demo data for local development and staging (§18.1).
-- Passwords below are Argon2id hashes of "Password123!" (DEV ONLY — never in prod).
-- Idempotent: re-running upserts by natural key.

SET app.institution_tz = 'Africa/Accra';

-- Departments
INSERT INTO departments (code, name, faculty) VALUES
  ('CS',   'Computer Science', 'Science'),
  ('MATH', 'Mathematics',      'Science'),
  ('BUS',  'Business Admin',   'Business')
ON CONFLICT (code) DO NOTHING;

-- Equipment
INSERT INTO equipment (code, name) VALUES
  ('PROJECTOR',       'Projector'),
  ('SMART_BOARD',     'Smart Board'),
  ('AUDIO_SYSTEM',    'Audio System'),
  ('CAMERA',          'Camera'),
  ('CONFERENCE_SETUP','Conference Setup')
ON CONFLICT (code) DO NOTHING;

-- Buildings
INSERT INTO buildings (code, name, campus) VALUES
  ('SCI', 'Science Block',  'Main'),
  ('ENG', 'Engineering Block', 'Main')
ON CONFLICT (code) DO NOTHING;

-- Rooms
INSERT INTO rooms (room_code, name, building_id, capacity, room_type, status)
SELECT v.room_code, v.name, b.id, v.capacity, v.room_type::room_type, 'ACTIVE'
FROM (VALUES
  ('A101', 'Lecture Hall A101', 'SCI', 120, 'LECTURE_HALL'),
  ('A102', 'Seminar Room A102',  'SCI', 40,  'SEMINAR_ROOM'),
  ('LAB1', 'Computing Lab 1',    'SCI', 60,  'LAB'),
  ('E201', 'Auditorium E201',    'ENG', 300, 'AUDITORIUM'),
  ('E202', 'Conference Room E202','ENG', 20,  'CONFERENCE_ROOM')
) AS v(room_code, name, bcode, capacity, room_type)
JOIN buildings b ON b.code = v.bcode
ON CONFLICT (room_code) DO NOTHING;

-- Equip A101 with a projector + audio.
INSERT INTO room_equipment (room_id, equipment_id, quantity)
SELECT r.id, e.id, 1 FROM rooms r, equipment e
WHERE r.room_code = 'A101' AND e.code IN ('PROJECTOR','AUDIO_SYSTEM')
ON CONFLICT DO NOTHING;

-- Users (password = "Password123!"). One per role.
INSERT INTO users (email, password_hash, full_name, role, status, department_id)
SELECT v.email, v.hash, v.full_name, v.role::user_role, 'ACTIVE', d.id
FROM (VALUES
  ('admin@cbs.example.edu',    '$argon2id$v=19$m=65536,t=3,p=2$zuGX5BP1ng00hcpl67NsGQ$U3e5r+04E+bcULh75MSFR3dFTfsKDUiRrKDzBibVbis', 'System Admin',    'SYSTEM_ADMIN',    'CS'),
  ('timetable@cbs.example.edu','$argon2id$v=19$m=65536,t=3,p=2$zuGX5BP1ng00hcpl67NsGQ$U3e5r+04E+bcULh75MSFR3dFTfsKDUiRrKDzBibVbis', 'Timetable Admin', 'TIMETABLE_ADMIN', 'CS'),
  ('officer@cbs.example.edu',  '$argon2id$v=19$m=65536,t=3,p=2$zuGX5BP1ng00hcpl67NsGQ$U3e5r+04E+bcULh75MSFR3dFTfsKDUiRrKDzBibVbis', 'Booking Officer', 'BOOKING_OFFICER', 'CS'),
  ('lecturer@cbs.example.edu', '$argon2id$v=19$m=65536,t=3,p=2$zuGX5BP1ng00hcpl67NsGQ$U3e5r+04E+bcULh75MSFR3dFTfsKDUiRrKDzBibVbis', 'Jane Lecturer',   'REQUESTER',       'MATH')
) AS v(email, hash, full_name, role, dept)
JOIN departments d ON d.code = v.dept
ON CONFLICT (email) DO NOTHING;

-- A draft semester (activate via the API to exercise BR2).
INSERT INTO semesters (name, start_date, end_date, status)
VALUES ('2026 Semester 1', DATE '2026-01-13', DATE '2026-05-15', 'DRAFT')
ON CONFLICT DO NOTHING;
