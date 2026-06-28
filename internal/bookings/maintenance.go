package bookings

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// MaintenanceView is the API projection of a maintenance window (§6.6).
type MaintenanceView struct {
	ID        uuid.UUID `json:"id"`
	RoomID    uuid.UUID `json:"room_id"`
	StartsAt  time.Time `json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	Reason    string    `json:"reason"`
	CreatedBy uuid.UUID `json:"created_by"`
}

func toMaintCreate(m dbgen.CreateMaintenanceWindowRow) MaintenanceView {
	return MaintenanceView{ID: m.ID, RoomID: m.RoomID, StartsAt: m.StartsAt.Time, EndsAt: m.EndsAt.Time, Reason: m.Reason, CreatedBy: m.CreatedBy}
}
func toMaintList(m dbgen.ListMaintenanceWindowsRow) MaintenanceView {
	return MaintenanceView{ID: m.ID, RoomID: m.RoomID, StartsAt: m.StartsAt.Time, EndsAt: m.EndsAt.Time, Reason: m.Reason, CreatedBy: m.CreatedBy}
}

// CreateMaintenance adds a maintenance window. The excl_maint_overlap constraint
// prevents overlapping windows for the same room.
func (s *Service) CreateMaintenance(ctx context.Context, roomID uuid.UUID, startsAt, endsAt time.Time, reason string, createdBy uuid.UUID) (MaintenanceView, error) {
	if !endsAt.After(startsAt) {
		return MaintenanceView{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "ends_at", Message: "must be after starts_at"})
	}
	m, err := s.store.CreateMaintenanceWindow(ctx, dbgen.CreateMaintenanceWindowParams{
		RoomID: roomID, StartsAt: pgconv.TS(startsAt), EndsAt: pgconv.TS(endsAt), Reason: reason, CreatedBy: createdBy,
	})
	if err != nil {
		return MaintenanceView{}, db.MapError(err)
	}
	return toMaintCreate(m), nil
}

func (s *Service) ListMaintenance(ctx context.Context, roomID *uuid.UUID) ([]MaintenanceView, error) {
	rows, err := s.store.ListMaintenanceWindows(ctx, roomID)
	if err != nil {
		return nil, err
	}
	views := make([]MaintenanceView, len(rows))
	for i, m := range rows {
		views[i] = toMaintList(m)
	}
	return views, nil
}

func (s *Service) DeleteMaintenance(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteMaintenanceWindow(ctx, id))
}
