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

// ── Approvability projection (FR8, §11) ──────────────────────────────────────

// blockerKind is one of the §11 approval-blocker kinds. It mirrors the web
// ApprovalBlocker.kind enum exactly.
type blockerKind string

const (
	blockerInPast          blockerKind = "IN_PAST"
	blockerCapacity        blockerKind = "CAPACITY"
	blockerLecture         blockerKind = "LECTURE"
	blockerMaintenance     blockerKind = "MAINTENANCE"
	blockerApprovedBooking blockerKind = "APPROVED_BOOKING"
	blockerCompetingPend   blockerKind = "COMPETING_PENDING"
)

// ApprovalBlocker explains why a pending booking can or cannot be approved.
// Matches the web `ApprovalBlocker` zod schema.
type ApprovalBlocker struct {
	Kind     blockerKind `json:"kind"`
	Message  string      `json:"message"`
	StartsAt *time.Time  `json:"starts_at,omitempty"`
	EndsAt   *time.Time  `json:"ends_at,omitempty"`
}

// deptRef is the nested department on a requester. Matches the fields the
// approvals queue reads off `requester.department` (only `name`).
type deptRef struct {
	ID   *uuid.UUID `json:"id,omitempty"`
	Name string     `json:"name"`
}

// requesterRef is the nested requester on an enriched booking. Matches the
// `requester` fields the approvals queue reads (full_name, department.name).
type requesterRef struct {
	ID         uuid.UUID `json:"id"`
	FullName   string    `json:"full_name"`
	Department *deptRef  `json:"department,omitempty"`
}

// roomRef is the nested room on an enriched booking. Matches the `room` fields
// the approvals queue reads (name, room_code).
type roomRef struct {
	ID       uuid.UUID `json:"id"`
	RoomCode string    `json:"room_code"`
	Name     string    `json:"name"`
}

// EnrichedBookingView is a BookingView with nested room + requester, matching
// the web `Booking` schema's optional `room`/`requester` relations.
type EnrichedBookingView struct {
	BookingView
	Room      *roomRef      `json:"room,omitempty"`
	Requester *requesterRef `json:"requester,omitempty"`
}

// Approvability is a pending booking enriched with the reasons it can or cannot
// be approved. Matches the web `BookingApprovability` zod schema exactly.
type Approvability struct {
	Booking               EnrichedBookingView `json:"booking"`
	CanApprove            bool                `json:"can_approve"`
	Blockers              []ApprovalBlocker   `json:"blockers"`
	CompetingPendingCount int64               `json:"competing_pending_count"`
}

// enrichedFromPending projects a joined pending row into an EnrichedBookingView.
func enrichedFromPending(b dbgen.ListPendingForApprovalRow) EnrichedBookingView {
	view := EnrichedBookingView{
		BookingView: BookingView{
			ID: b.ID, RoomID: b.RoomID, RequestedBy: b.RequestedBy, Purpose: b.Purpose,
			AttendeeCount: int(b.AttendeeCount), StartsAt: b.StartsAt.Time, EndsAt: b.EndsAt.Time,
			Status: string(b.Status), ReviewedBy: b.ReviewedBy, ReviewNote: b.ReviewNote,
			ReviewedAt: pgconv.TimePtr(b.ReviewedAt), CreatedAt: pgconv.TimePtr(b.CreatedAt),
		},
		Room: &roomRef{ID: b.RoomID, RoomCode: b.RoomCode, Name: b.RoomName},
		Requester: &requesterRef{
			ID: b.RequestedBy, FullName: b.RequesterFullName,
		},
	}
	if b.RequesterDepartmentName != nil {
		view.Requester.Department = &deptRef{ID: b.RequesterDepartmentID, Name: *b.RequesterDepartmentName}
	}
	return view
}

// Notifier receives booking lifecycle events (§7.8). Implemented by the
// notifications module; bookings depends only on this narrow interface.
type Notifier interface {
	BookingEvent(event string, b BookingView)
}

// noopNotifier is used when notifications are not wired (tests).
type noopNotifier struct{}

func (noopNotifier) BookingEvent(string, BookingView) {}
