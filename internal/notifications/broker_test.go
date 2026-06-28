package notifications

import (
	"testing"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestBrokerDeliversToSubscriber(t *testing.T) {
	b := NewBroker()
	uid := uuid.New()
	ch, unsub := b.Subscribe(uid)
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
	ch, unsub := b.Subscribe(uid)
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
	_, unsub := b.Subscribe(uid) // never drained
	defer unsub()
	// Far more than the buffer; Publish must never block.
	for i := 0; i < 1000; i++ {
		b.Publish(dbgen.Notification{UserID: uid})
	}
}

func TestRenderBooking(t *testing.T) {
	view := bookings.BookingView{Purpose: "Meeting"}
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
	}
}
