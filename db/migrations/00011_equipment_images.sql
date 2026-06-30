-- +goose Up
-- Equipment uses the same main image + gallery model as buildings and rooms.

ALTER TABLE equipment
  ADD COLUMN image_url text,
  ADD COLUMN image_public_id text,
  ADD COLUMN gallery_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN gallery_public_ids text[] NOT NULL DEFAULT '{}'::text[];

-- +goose Down
ALTER TABLE equipment
  DROP COLUMN IF EXISTS gallery_public_ids,
  DROP COLUMN IF EXISTS gallery_urls,
  DROP COLUMN IF EXISTS image_public_id,
  DROP COLUMN IF EXISTS image_url;
