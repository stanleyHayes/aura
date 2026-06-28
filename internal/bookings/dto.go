package bookings

import (
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// BookingView is the API projection of a booking.
type BookingView struct {
	ID            uuid.UUID  `json:"id"`
	RoomID        uuid.UUID  `json:"room_id"`
	RequestedBy   uuid.UUID  `json:"requested_by"`
	Purpose       string     `json:"purpose"`
	AttendeeCount int        `json:"attendee_count"`
	StartsAt      time.Time  `json:"starts_at"`
	EndsAt        time.Time  `json:"ends_at"`
	Status        string     `json:"status"`
	ReviewedBy    *uuid.UUID `json:"reviewed_by"`
	ReviewNote    *string    `json:"review_note"`
	ReviewedAt    *time.Time `json:"reviewed_at"`
	CreatedAt     *time.Time `json:"created_at"`
}

func viewFromCreate(b dbgen.CreateBookingRow) BookingView {
	return BookingView{
		ID: b.ID, RoomID: b.RoomID, RequestedBy: b.RequestedBy, Purpose: b.Purpose,
		AttendeeCount: int(b.AttendeeCount), StartsAt: b.StartsAt.Time, EndsAt: b.EndsAt.Time,
		Status: string(b.Status), ReviewedBy: b.ReviewedBy, ReviewNote: b.ReviewNote,
		ReviewedAt: pgconv.TimePtr(b.ReviewedAt), CreatedAt: pgconv.TimePtr(b.CreatedAt),
	}
}

func viewFromGet(b dbgen.GetBookingRow) BookingView {
	return BookingView{
		ID: b.ID, RoomID: b.RoomID, RequestedBy: b.RequestedBy, Purpose: b.Purpose,
		AttendeeCount: int(b.AttendeeCount), StartsAt: b.StartsAt.Time, EndsAt: b.EndsAt.Time,
		Status: string(b.Status), ReviewedBy: b.ReviewedBy, ReviewNote: b.ReviewNote,
		ReviewedAt: pgconv.TimePtr(b.ReviewedAt), CreatedAt: pgconv.TimePtr(b.CreatedAt),
	}
}

func viewFromList(b dbgen.ListBookingsRow) BookingView {
	return BookingView{
		ID: b.ID, RoomID: b.RoomID, RequestedBy: b.RequestedBy, Purpose: b.Purpose,
		AttendeeCount: int(b.AttendeeCount), StartsAt: b.StartsAt.Time, EndsAt: b.EndsAt.Time,
		Status: string(b.Status), ReviewedBy: b.ReviewedBy, ReviewNote: b.ReviewNote,
		ReviewedAt: pgconv.TimePtr(b.ReviewedAt), CreatedAt: pgconv.TimePtr(b.CreatedAt),
	}
}

func viewFromStatus(b dbgen.SetBookingStatusRow) BookingView {
	return BookingView{
		ID: b.ID, RoomID: b.RoomID, RequestedBy: b.RequestedBy, Purpose: b.Purpose,
		AttendeeCount: int(b.AttendeeCount), StartsAt: b.StartsAt.Time, EndsAt: b.EndsAt.Time,
		Status: string(b.Status), ReviewedBy: b.ReviewedBy, ReviewNote: b.ReviewNote,
		ReviewedAt: pgconv.TimePtr(b.ReviewedAt), CreatedAt: pgconv.TimePtr(b.CreatedAt),
	}
}

// Notifier receives booking lifecycle events (§7.8). Implemented by the
// notifications module; bookings depends only on this narrow interface.
type Notifier interface {
	BookingEvent(event string, b BookingView)
}

// noopNotifier is used when notifications are not wired (tests).
type noopNotifier struct{}

func (noopNotifier) BookingEvent(string, BookingView) {}
