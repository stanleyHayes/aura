package bookings_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestMaintenanceWindowsAndConflict(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(14, 16)

	m, err := svc.CreateMaintenance(ctx, f.roomID, start, end, "Deep clean", f.officer)
	require.NoError(t, err)
	require.Equal(t, "Deep clean", m.Reason)

	// end <= start rejected.
	_, err = svc.CreateMaintenance(ctx, f.roomID, end, start, "bad", f.officer)
	require.Error(t, err)

	// Overlapping maintenance window for the same room is rejected (excl_maint_overlap).
	s2, e2 := f.tomorrowWindow(15, 17)
	_, err = svc.CreateMaintenance(ctx, f.roomID, s2, e2, "overlap", f.officer)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "CONFLICT", ae.Code)

	list, err := svc.ListMaintenance(ctx, &f.roomID)
	require.NoError(t, err)
	require.Len(t, list, 1)

	// A booking overlapping maintenance is rejected at submission.
	bs, be := f.tomorrowWindow(15, 16)
	_, err = svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "clash", AttendeeCount: 5, StartsAt: bs, EndsAt: be})
	ae, ok = apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "CONFLICTS_WITH_MAINTENANCE", ae.Code)

	require.NoError(t, svc.DeleteMaintenance(ctx, m.ID))
	list, err = svc.ListMaintenance(ctx, &f.roomID)
	require.NoError(t, err)
	require.Empty(t, list)
}

func TestBookingGetAndList(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(8, 9)

	res, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "G", AttendeeCount: 5, StartsAt: start, EndsAt: end})
	require.NoError(t, err)

	got, err := svc.Get(ctx, res.Booking.ID)
	require.NoError(t, err)
	require.Equal(t, res.Booking.ID, got.ID)

	mine, err := svc.List(ctx, dbgen.ListBookingsParams{RequesterID: &f.requester, Lim: 50})
	require.NoError(t, err)
	require.NotEmpty(t, mine)
	found := false
	for _, b := range mine {
		if b.ID == res.Booking.ID {
			found = true
		}
	}
	require.True(t, found, "created booking must appear in the requester's list")
}
