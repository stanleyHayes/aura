-- AURA — clean production/demo seed (§18.1).
--
-- IDEMPOTENT: safe to run repeatedly (psql -f, `make seed`, or on API boot via
-- SEED_DATA=true). Every statement uses a natural key (ON CONFLICT / WHERE NOT
-- EXISTS) so a re-run inserts nothing new and never errors.
--
-- DEMO ACCOUNTS: the four users below share ONE password ("Password123!", stored
-- as an Argon2id hash). They exist so a fresh deployment is immediately usable for
-- a demo. ROTATE THESE FOR REAL PRODUCTION — change the passwords (or delete the
-- accounts) once real administrators have onboarded.

SET app.institution_tz = 'Africa/Accra';

-- ── Departments ──────────────────────────────────────────────────────────────
INSERT INTO departments (code, name, faculty) VALUES
  ('CSIS', 'Computer Science & Information Systems', 'Science & Technology'),
  ('ENGR', 'Engineering',                            'Science & Technology'),
  ('BA',   'Business Administration',                'Business'),
  ('MATH', 'Mathematics & Statistics',               'Science & Technology'),
  ('HUSS', 'Humanities & Social Sciences',           'Humanities')
ON CONFLICT (code) DO NOTHING;

-- ── Equipment (generic catalogue) ────────────────────────────────────────────
INSERT INTO equipment (code, name) VALUES
  ('PROJECTOR',       'Projector'),
  ('SMART_BOARD',     'Smart Board'),
  ('AUDIO_SYSTEM',    'Audio System'),
  ('CAMERA',          'Camera'),
  ('CONFERENCE_SETUP','Conference Setup')
ON CONFLICT (code) DO NOTHING;

-- ── Buildings (real Ashesi facilities) ───────────────────────────────────────
-- Natural key: lower(name). Building codes are deterministic initials.
INSERT INTO buildings (code, name, campus)
SELECT v.code, v.name, 'Ashesi University, Berekuso'
FROM (VALUES
  ('APT',  'Apt Hall'),
  ('BIO',  'Bio Lab'),
  ('DFH',  'Databank Foundation Hall'),
  ('EE',   'EE Lab'),
  ('FL',   'Fab Lab'),
  ('JH',   'Jackson Hall'),
  ('JL',   'Jackson Lab'),
  ('NM',   'Norton-Motulsky'),
  ('NH',   'Nutor Hall'),
  ('OT',   'OT'),
  ('RMPR', 'Radichel MPR'),
  ('SL',   'Science Lab')
) AS v(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE lower(b.name) = lower(v.name)
);

-- ── Rooms (real Ashesi rooms) ────────────────────────────────────────────────
-- Natural key: lower(name). room_code is a deterministic, collision-free
-- building-initials[-number] code. Capacity/type/status as specified.
INSERT INTO rooms (room_code, name, building_id, capacity, room_type, status)
SELECT v.room_code, v.name, b.id, v.capacity, v.room_type::room_type, 'ACTIVE'
FROM (VALUES
  ('APT-216', 'Apt Hall 216',              'Apt Hall',                 68, 'LECTURE_HALL'),
  ('BIO',     'Bio Lab',                   'Bio Lab',                  24, 'LAB'),
  ('DFH-218', 'Databank Foundation Hall 218','Databank Foundation Hall',69, 'LECTURE_HALL'),
  ('EE',      'EE Lab',                    'EE Lab',                   48, 'LAB'),
  ('FL-203',  'Fab Lab 203',               'Fab Lab',                  70, 'LAB'),
  ('FL-303',  'Fab Lab 303',               'Fab Lab',                  57, 'LAB'),
  ('JH-115',  'Jackson Hall 115',          'Jackson Hall',             68, 'LECTURE_HALL'),
  ('JH-116',  'Jackson Hall 116',          'Jackson Hall',             54, 'LECTURE_HALL'),
  ('JL-221',  'Jackson Lab 221',           'Jackson Lab',              60, 'LAB'),
  ('JL-222',  'Jackson Lab 222',           'Jackson Lab',              54, 'LAB'),
  ('NM-207A', 'Norton-Motulsky 207A',      'Norton-Motulsky',          48, 'LECTURE_HALL'),
  ('NM-207B', 'Norton-Motulsky 207B',      'Norton-Motulsky',          68, 'LECTURE_HALL'),
  ('NH-100',  'Nutor Hall 100',            'Nutor Hall',               68, 'LECTURE_HALL'),
  ('NH-115',  'Nutor Hall 115',            'Nutor Hall',               69, 'LECTURE_HALL'),
  ('NH-216',  'Nutor Hall 216',            'Nutor Hall',               51, 'LECTURE_HALL'),
  ('OT',      'OT',                        'OT',                       28, 'LECTURE_HALL'),
  ('RMPR',    'Radichel MPR',              'Radichel MPR',             40, 'CONFERENCE_ROOM'),
  ('SL',      'Science Lab',               'Science Lab',              30, 'LAB')
) AS v(room_code, name, building_name, capacity, room_type)
JOIN buildings b ON lower(b.name) = lower(v.building_name)
WHERE NOT EXISTS (
  SELECT 1 FROM rooms r WHERE lower(r.name) = lower(v.name)
);

-- ── Room equipment (equip a couple of lecture halls) ─────────────────────────
INSERT INTO room_equipment (room_id, equipment_id, quantity)
SELECT r.id, e.id, 1
FROM rooms r, equipment e
WHERE lower(r.name) IN (lower('Nutor Hall 100'), lower('Jackson Hall 115'))
  AND e.code IN ('PROJECTOR', 'AUDIO_SYSTEM')
ON CONFLICT DO NOTHING;

-- ── Demo users — distinct strong passwords (Argon2id). The plaintext lives only
--    in the gitignored credentials.txt and is shared with operators out-of-band.
--    Rotate or delete these accounts once real staff have onboarded. ──
INSERT INTO users (email, password_hash, full_name, role, status, department_id)
SELECT v.email, v.hash, v.full_name, v.role::user_role, 'ACTIVE', d.id
FROM (VALUES
  ('aura.admin@ashesi.edu.gh',     '$argon2id$v=19$m=65536,t=3,p=2$vy/TlZIM17Lf0R9bX1W8tw$KJAnqsAkqcMMuLvSDpDRZKTcQ7hfrkejsIAFWjCWbQs', 'System Administrator',    'SYSTEM_ADMIN',    'CSIS'),
  ('aura.timetable@ashesi.edu.gh', '$argon2id$v=19$m=65536,t=3,p=2$BMTmO4eIB3l+/CXGxTMIlA$Zz0ha6ZWOtBXZPMQU29iRcDMmUEXGuROhn3IvPGkzAo', 'Timetable Administrator', 'TIMETABLE_ADMIN', 'CSIS'),
  ('aura.officer@ashesi.edu.gh',   '$argon2id$v=19$m=65536,t=3,p=2$Ud0zOCFezWef2CPLeTkpaw$PS2mau4NUdA38CPjHr+FzgSiSsO5c3OBPmCVK5s8CTM', 'Booking Officer', 'BOOKING_OFFICER', 'BA'),
  ('aura.lecturer@ashesi.edu.gh',  '$argon2id$v=19$m=65536,t=3,p=2$/PeQjKP5PjGy+VdYw1pv5Q$aws0y1dXWwBRGBEqqlZdJIj+vZPnuW2aUK706UqTF9M', 'Demo Lecturer',   'REQUESTER',       'MATH')
) AS v(email, hash, full_name, role, dept)
JOIN departments d ON d.code = v.dept
ON CONFLICT (email) DO NOTHING;

-- ── Semester (one DRAFT; activate via the API to exercise BR2) ────────────────
INSERT INTO semesters (name, start_date, end_date, status)
SELECT '2026 Semester 3', DATE '2026-05-18', DATE '2026-08-28', 'DRAFT'
WHERE NOT EXISTS (
  SELECT 1 FROM semesters s WHERE s.name = '2026 Semester 3'
);
