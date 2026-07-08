-- +goose Up
-- +goose StatementBegin
ALTER TABLE bookings ADD COLUMN cancel_note TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE bookings DROP COLUMN cancel_note;
-- +goose StatementEnd
