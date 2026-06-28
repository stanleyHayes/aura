package bookings_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestExpireStalePending verifies the worker sweep (§7.2): PENDING bookings whose
// start time has passed become EXPIRED. A past PENDING row cannot be inserted
// normally (the trigger raises BOOKING_IN_PAST), so we insert one with triggers
// disabled to simulate a request that aged into the past while pending.
func TestExpireStalePending(t *testing.T) {
	f := newFixture(t, 50)
	ctx := context.Background()

	id := uuid.New()
	_, err := f.store.Pool.Exec(ctx, "SET session_replication_role = replica")
	require.NoError(t, err)
	_, err = f.store.Pool.Exec(ctx, `
		INSERT INTO bookings (id, room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status)
		VALUES ($1, $2, $3, 'aged out', 5, now() - interval '2 hours', now() - interval '1 hour', 'PENDING')`,
		id, f.roomID, f.requester)
	require.NoError(t, err)
	_, err = f.store.Pool.Exec(ctx, "SET session_replication_role = default")
	require.NoError(t, err)

	n, err := f.store.ExpireStalePending(ctx)
	require.NoError(t, err)
	require.GreaterOrEqual(t, n, int64(1))

	got, err := f.store.GetBooking(ctx, id)
	require.NoError(t, err)
	require.Equal(t, "EXPIRED", string(got.Status))
}
