package notifications

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestBrokerDeliversToSubscriber(t *testing.T) {
	b := NewBroker()
	uid := uuid.New()
	ch, unsub, err := b.Subscribe(uid)
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	defer unsub()

	b.Publish(dbgen.Notification{UserID: uid, Title: "hello"})
	select {
	case n := <-ch:
		if n.Title != "hello" {
			t.Fatalf("got %q", n.Title)
		}
	default:
		t.Fatal("expected a delivered notification")
	}

	// A notification for a different user is not delivered to this subscriber.
	b.Publish(dbgen.Notification{UserID: uuid.New(), Title: "other"})
	select {
	case n := <-ch:
		t.Fatalf("unexpected delivery: %q", n.Title)
	default:
	}
}

func TestBrokerUnsubscribeClosesChannel(t *testing.T) {
	b := NewBroker()
	uid := uuid.New()
	ch, unsub, err := b.Subscribe(uid)
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	unsub()
	if _, open := <-ch; open {
		t.Fatal("channel should be closed after unsubscribe")
	}
	// Publishing after everyone unsubscribed must not panic.
	b.Publish(dbgen.Notification{UserID: uid})
}

func TestBrokerDropsWhenBufferFull(t *testing.T) {
	b := NewBroker()
	uid := uuid.New()
	_, unsub, err := b.Subscribe(uid) // never drained
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	defer unsub()
	// Far more than the buffer; Publish must never block.
	for i := 0; i < 1000; i++ {
		b.Publish(dbgen.Notification{UserID: uid})
	}
}

func TestBrokerPerUserStreamCap(t *testing.T) {
	b := NewBroker()
	uid := uuid.New()

	unsubs := make([]func(), 0, maxStreamsPerUser)
	for i := 0; i < maxStreamsPerUser; i++ {
		_, unsub, err := b.Subscribe(uid)
		if err != nil {
			t.Fatalf("subscribe %d: unexpected error %v", i, err)
		}
		unsubs = append(unsubs, unsub)
	}

	// The next subscription must be rejected.
	if _, _, err := b.Subscribe(uid); err == nil {
		t.Fatal("expected ErrTooManyStreams once the per-user cap is reached")
	}

	// A different user is unaffected by this user's cap.
	if _, unsub, err := b.Subscribe(uuid.New()); err != nil {
		t.Fatalf("a different user should be able to subscribe: %v", err)
	} else {
		unsub()
	}

	// Releasing one frees a slot for a new subscription.
	unsubs[0]()
	if _, unsub, err := b.Subscribe(uid); err != nil {
		t.Fatalf("subscription should succeed after a slot is freed: %v", err)
	} else {
		unsub()
	}
	for _, u := range unsubs[1:] {
		u()
	}
}

func TestRenderBooking(t *testing.T) {
	// A populated booking time must appear, formatted, in the body (PART B).
	starts := time.Date(2026, time.July, 4, 14, 30, 0, 0, time.UTC)
	view := bookings.BookingView{Purpose: "Meeting", StartsAt: starts}
	wantDate := "4 Jul 2026 14:30"
	cases := map[string]string{
		"BOOKING_SUBMITTED": "New booking request",
		"BOOKING_APPROVED":  "Booking approved",
		"BOOKING_REJECTED":  "Booking rejected",
		"BOOKING_CANCELLED": "Booking cancelled",
		"SOMETHING_ELSE":    "Booking update",
	}
	for event, wantTitle := range cases {
		title, body := renderBooking(event, view)
		if title != wantTitle {
			t.Errorf("renderBooking(%s) title = %q, want %q", event, title, wantTitle)
		}
		if body == "" {
			t.Errorf("renderBooking(%s) empty body", event)
		}
		if !strings.Contains(body, wantDate) {
			t.Errorf("renderBooking(%s) body = %q, want it to contain the real date %q", event, body, wantDate)
		}
	}

	// A zero StartsAt must NOT render the Go zero time ("1 Jan 0001").
	_, body := renderBooking("BOOKING_APPROVED", bookings.BookingView{Purpose: "X"})
	if strings.Contains(body, "0001") {
		t.Errorf("renderBooking with zero StartsAt leaked the zero time: %q", body)
	}
}
