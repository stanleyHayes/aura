package bookings_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/apperr"
)

// TestOverrideCancelsConflicting verifies BR6: an admin override forces a booking
// through, cancelling the conflicting approved booking in the same transaction.
func TestOverrideCancelsConflicting(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(9, 11)

	// Booking A: submitted then approved → owns the slot.
	a, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "A", AttendeeCount: 10, StartsAt: start, EndsAt: end})
	require.NoError(t, err)
	_, err = svc.Approve(ctx, a.Booking.ID, f.officer, nil)
	require.NoError(t, err)

	// Booking B: overlapping, still PENDING (pending never reserves — BR5).
	b, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "B", AttendeeCount: 10, StartsAt: start, EndsAt: end})
	require.NoError(t, err)

	// Admin override on B → B approved, A cancelled.
	approved, cancelled, err := svc.Override(ctx, b.Booking.ID, f.officer, nil)
	require.NoError(t, err)
	require.Equal(t, "APPROVED", approved.Status)
	require.Len(t, cancelled, 1)
	require.Equal(t, a.Booking.ID, cancelled[0].ID)
	require.Equal(t, "CANCELLED", cancelled[0].Status)

	// Exactly one approved booking remains for the slot.
	var n int
	require.NoError(t, f.store.Pool.QueryRow(ctx,
		"SELECT count(*) FROM bookings WHERE room_id=$1 AND status='APPROVED'", f.roomID).Scan(&n))
	require.Equal(t, 1, n)
}

func TestCancelTransitions(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(12, 13)

	b, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "C", AttendeeCount: 5, StartsAt: start, EndsAt: end})
	require.NoError(t, err)

	v, err := svc.Cancel(ctx, b.Booking.ID, f.requester)
	require.NoError(t, err)
	require.Equal(t, "CANCELLED", v.Status)

	// Cancelling a cancelled booking is an illegal transition.
	_, err = svc.Cancel(ctx, b.Booking.ID, f.requester)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "INVALID_STATE_TRANSITION", ae.Code)
}

func TestRejectThenApproveIsIllegal(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(15, 16)

	b, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "D", AttendeeCount: 5, StartsAt: start, EndsAt: end})
	require.NoError(t, err)

	v, err := svc.Reject(ctx, b.Booking.ID, f.officer, "not this time")
	require.NoError(t, err)
	require.Equal(t, "REJECTED", v.Status)

	_, err = svc.Approve(ctx, b.Booking.ID, f.officer, nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "INVALID_STATE_TRANSITION", ae.Code)
}

// TestNonOverlappingApprovalsBothSucceed confirms the exclusion constraint only
// blocks genuine overlaps — adjacent/disjoint slots in the same room are fine.
func TestNonOverlappingApprovalsBothSucceed(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	s1, e1 := f.tomorrowWindow(8, 10)
	s2, e2 := f.tomorrowWindow(10, 12) // adjacent, touches at 10:00

	a, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "A", AttendeeCount: 5, StartsAt: s1, EndsAt: e1})
	require.NoError(t, err)
	b, err := svc.Create(ctx, bookings.CreateInput{RoomID: f.roomID, RequestedBy: f.requester, Purpose: "B", AttendeeCount: 5, StartsAt: s2, EndsAt: e2})
	require.NoError(t, err)

	_, err = svc.Approve(ctx, a.Booking.ID, f.officer, nil)
	require.NoError(t, err)
	_, err = svc.Approve(ctx, b.Booking.ID, f.officer, nil)
	require.NoError(t, err, "adjacent (non-overlapping) bookings must both be approvable")
}
