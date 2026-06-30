package notifications

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/logging"
)

type fakeMailer struct {
	mu   sync.Mutex
	sent []string
}

func (f *fakeMailer) Send(_ context.Context, to, _, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, to)
	return nil
}

func (f *fakeMailer) sentTo(addr string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, s := range f.sent {
		if s == addr {
			return true
		}
	}
	return false
}

func TestDispatchApprovedNotifiesRequester(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)

	mail := &fakeMailer{}
	broker := NewBroker()
	svc := NewService(store, mail, broker, logging.New(0))

	suffix := uuid.NewString()[:8]
	reqUser, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "nreq-" + suffix + "@x.edu", PasswordHash: "x", FullName: "Req",
		Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)

	ch, unsub, err := broker.Subscribe(reqUser.ID)
	require.NoError(t, err)
	defer unsub()

	starts := time.Date(2026, time.July, 4, 14, 30, 0, 0, time.UTC)
	view := bookings.BookingView{ID: uuid.New(), RequestedBy: reqUser.ID, Purpose: "Demo", StartsAt: starts}
	svc.dispatchBookingEvent(ctx, "BOOKING_APPROVED", view) // synchronous core

	// Persisted in-app notification for the requester.
	unread, err := store.CountUnread(ctx, reqUser.ID)
	require.NoError(t, err)
	require.GreaterOrEqual(t, unread, int64(1))
	list, err := store.ListNotifications(ctx, dbgen.ListNotificationsParams{UserID: reqUser.ID, Lim: 10})
	require.NoError(t, err)
	require.Equal(t, "BOOKING_APPROVED", list[0].Type)
	// PART B: the body carries the real booking date, not the zero time.
	require.Contains(t, list[0].Body, "4 Jul 2026 14:30")

	// Email sent and live event published.
	require.True(t, mail.sentTo(reqUser.Email))
	select {
	case n := <-ch:
		require.Equal(t, "BOOKING_APPROVED", n.Type)
	default:
		t.Fatal("expected a live SSE publish")
	}
}

func TestDispatchSubmittedNotifiesOfficers(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)

	svc := NewService(store, &fakeMailer{}, NewBroker(), logging.New(0))

	suffix := uuid.NewString()[:8]
	officer, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "noff-" + suffix + "@x.edu", PasswordHash: "x", FullName: "Off",
		Role: dbgen.UserRoleBOOKINGOFFICER, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)

	svc.dispatchBookingEvent(ctx, "BOOKING_SUBMITTED", bookings.BookingView{ID: uuid.New(), Purpose: "New"})

	list, err := store.ListNotifications(ctx, dbgen.ListNotificationsParams{UserID: officer.ID, Lim: 10})
	require.NoError(t, err)
	require.NotEmpty(t, list, "the booking officer should receive a submission notification")
	require.Equal(t, "BOOKING_SUBMITTED", list[0].Type)
}
