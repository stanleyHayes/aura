-- +goose Up
-- Catalogue tables (§6.4).

CREATE TABLE buildings (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  campus     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id   uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE,   -- PROJECTOR, CAMERA, AUDIO_SYSTEM, SMART_BOARD, CONFERENCE_SETUP
  name text NOT NULL
);

CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  room_code   text NOT NULL UNIQUE,
  name        text NOT NULL,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  capacity    int  NOT NULL CHECK (capacity > 0),
  room_type   room_type NOT NULL,
  status      room_status NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rooms_building  ON rooms(building_id);
CREATE INDEX idx_rooms_capacity  ON rooms(capacity);
CREATE INDEX idx_rooms_type      ON rooms(room_type);
CREATE INDEX idx_rooms_status    ON rooms(status);
CREATE INDEX idx_rooms_name_trgm ON rooms USING gin (name gin_trgm_ops);

CREATE TABLE room_equipment (
  room_id      uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  quantity     int  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (room_id, equipment_id)
);

-- +goose Down
DROP TABLE IF EXISTS room_equipment;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS buildings;
