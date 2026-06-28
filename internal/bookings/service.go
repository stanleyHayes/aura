package bookings

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/aura/cbs/internal/availability"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/metrics"
	"github.com/aura/cbs/internal/platform/pgconv"
)

type Service struct {
	store    *db.Store
	loc      *time.Location
	notifier Notifier
}

func NewService(store *db.Store, loc *time.Location, notifier Notifier) *Service {
	if notifier == nil {
		notifier = noopNotifier{}
	}
	return &Service{store: store, loc: loc, notifier: notifier}
}

// CreateInput is a new booking request (FR7).
type CreateInput struct {
	RoomID        uuid.UUID
	RequestedBy   uuid.UUID
	Purpose       string
	AttendeeCount int
	StartsAt      time.Time
	EndsAt        time.Time
}

// SubmitResult carries the created booking plus FR8 context (competing pendings).
type SubmitResult struct {
	Booking          BookingView `json:"booking"`
	CompetingPending int64       `json:"competing_pending"`
}

// Create submits a PENDING request. Hard conflicts with lectures/maintenance are
// rejected at submission (BR1) — there is no point queuing a request that can
// never be approved. Competing PENDING requests are allowed but surfaced (BR5/FR8).
// The database trigger independently enforces past/single-day/capacity (§6.7).
func (s *Service) Create(ctx context.Context, in CreateInput) (SubmitResult, error) {
	if in.Purpose == "" {
		return SubmitResult{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "purpose", Message: "required"})
	}
	if in.AttendeeCount <= 0 || in.AttendeeCount > 100000 {
		return SubmitResult{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "attendee_count", Message: "must be between 1 and 100000"})
	}
	if !in.EndsAt.After(in.StartsAt) {
		return SubmitResult{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "ends_at", Message: "must be after starts_at"})
	}

	lecture, maintenance, err := s.hardConflicts(ctx, s.store.Queries, in.RoomID, in.StartsAt, in.EndsAt)
	if err != nil {
		return SubmitResult{}, err
	}
	if lecture {
		return SubmitResult{}, apperr.ErrConflictsLecture
	}
	if maintenance {
		return SubmitResult{}, apperr.ErrConflictsMaintenance
	}

	row, err := s.store.CreateBooking(ctx, dbgen.CreateBookingParams{
		RoomID: in.RoomID, RequestedBy: in.RequestedBy, Purpose: in.Purpose,
		AttendeeCount: int32(in.AttendeeCount), StartsAt: pgconv.TS(in.StartsAt), EndsAt: pgconv.TS(in.EndsAt),
	})
	if err != nil {
		return SubmitResult{}, db.MapError(err)
	}
	view := viewFromCreate(row)

	competing, _ := s.store.CountPendingOverlap(ctx, dbgen.CountPendingOverlapParams{
		RoomID: in.RoomID, ExcludeID: row.ID, WinStart: pgconv.TS(in.StartsAt), WinEnd: pgconv.TS(in.EndsAt),
	})
	metrics.BookingCreated()
	s.notifier.BookingEvent("BOOKING_SUBMITTED", view)
	return SubmitResult{Booking: view, CompetingPending: competing}, nil
}

// hardConflicts reports whether the window overlaps an active-semester lecture or
// a maintenance window for the room. Uses the same data the trigger checks, but
// at submission time (when the trigger does not, because the row is PENDING).
func (s *Service) hardConflicts(ctx context.Context, q *dbgen.Queries, roomID uuid.UUID, startsAt, endsAt time.Time) (lecture, maintenance bool, err error) {
	day := time.Date(startsAt.In(s.loc).Year(), startsAt.In(s.loc).Month(), startsAt.In(s.loc).Day(), 0, 0, 0, 0, s.loc)
	weekday := availability.WeekdayEnum(day)
	startMin := minutesInto(startsAt.In(s.loc), day)
	endMin := minutesInto(endsAt.In(s.loc), day)
	win := availability.Interval{Start: startMin, End: endMin}

	lectures, err := q.ListRoomLecturesOnDay(ctx, dbgen.ListRoomLecturesOnDayParams{
		RoomID: roomID, Day: weekday, OnDate: pgconv.Date(day),
	})
	if err != nil {
		return false, false, err
	}
	for _, lec := range lectures {
		sh, sm := pgconv.PgTimeToClock(lec.StartTime)
		eh, em := pgconv.PgTimeToClock(lec.EndTime)
		if availability.Overlaps(win, availability.Interval{Start: sh*60 + sm, End: eh*60 + em}) {
			lecture = true
			break
		}
	}

	dayStart, dayEnd := day, day.Add(24*time.Hour)
	maint, err := q.ListMaintenanceForRoomInRange(ctx, dbgen.ListMaintenanceForRoomInRangeParams{
		RoomID: roomID, DayStart: pgconv.TS(dayStart), DayEnd: pgconv.TS(dayEnd),
	})
	if err != nil {
		return false, false, err
	}
	for _, m := range maint {
		if m.StartsAt.Time.Before(endsAt) && startsAt.Before(m.EndsAt.Time) {
			maintenance = true
			break
		}
	}
	return lecture, maintenance, nil
}

// Approve transitions PENDING→APPROVED. A per-room advisory lock serialises
// competing approvals so the partial EXCLUDE constraint resolves the race
// deterministically; a violation maps to 409 SLOT_NO_LONGER_AVAILABLE (§7.3).
func (s *Service) Approve(ctx context.Context, bookingID, officerID uuid.UUID, note *string) (BookingView, error) {
	var view BookingView
	err := s.store.WithinTxDefault(ctx, func(q *dbgen.Queries, tx pgx.Tx) error {
		b, err := q.GetBookingForUpdate(ctx, bookingID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.ErrNotFound
			}
			return err
		}
		if !CanTransition(b.Status, dbgen.BookingStatusAPPROVED) {
			return apperr.ErrInvalidTransition.WithDetail("cannot approve a %s booking", b.Status)
		}
		if err := db.AdvisoryXactLock(ctx, tx, b.RoomID.String()); err != nil {
			return err
		}
		row, err := q.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{
			ID: bookingID, Status: dbgen.BookingStatusAPPROVED, ReviewedBy: &officerID, ReviewNote: note,
		})
		if err != nil {
			return db.MapError(err)
		}
		view = viewFromStatus(row)
		return nil
	})
	if err != nil {
		return BookingView{}, err
	}
	metrics.BookingApproved()
	s.notifier.BookingEvent("BOOKING_APPROVED", view)
	return view, nil
}

// Reject transitions PENDING→REJECTED with a required note.
func (s *Service) Reject(ctx context.Context, bookingID, officerID uuid.UUID, note string) (BookingView, error) {
	b, err := s.getStatus(ctx, bookingID)
	if err != nil {
		return BookingView{}, err
	}
	if !CanTransition(b, dbgen.BookingStatusREJECTED) {
		return BookingView{}, apperr.ErrInvalidTransition.WithDetail("cannot reject a %s booking", b)
	}
	row, err := s.store.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{
		ID: bookingID, Status: dbgen.BookingStatusREJECTED, ReviewedBy: &officerID, ReviewNote: &note,
	})
	if err != nil {
		return BookingView{}, db.MapError(err)
	}
	view := viewFromStatus(row)
	metrics.BookingRejected()
	s.notifier.BookingEvent("BOOKING_REJECTED", view)
	return view, nil
}

// Cancel transitions PENDING/APPROVED→CANCELLED. Ownership is checked by caller.
func (s *Service) Cancel(ctx context.Context, bookingID, actorID uuid.UUID) (BookingView, error) {
	b, err := s.getStatus(ctx, bookingID)
	if err != nil {
		return BookingView{}, err
	}
	if !CanTransition(b, dbgen.BookingStatusCANCELLED) {
		return BookingView{}, apperr.ErrInvalidTransition.WithDetail("cannot cancel a %s booking", b)
	}
	row, err := s.store.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{
		ID: bookingID, Status: dbgen.BookingStatusCANCELLED, ReviewedBy: &actorID,
	})
	if err != nil {
		return BookingView{}, db.MapError(err)
	}
	view := viewFromStatus(row)
	metrics.BookingCancelled()
	s.notifier.BookingEvent("BOOKING_CANCELLED", view)
	return view, nil
}

// Override forces a booking through (BR6), cancelling any conflicting APPROVED
// bookings in the same transaction. Lectures still take precedence (BR1): if the
// slot is owned by a lecture, the validation trigger rejects the override.
func (s *Service) Override(ctx context.Context, bookingID, adminID uuid.UUID, note *string) (BookingView, []BookingView, error) {
	var approved BookingView
	var cancelled []BookingView
	err := s.store.WithinTxDefault(ctx, func(q *dbgen.Queries, tx pgx.Tx) error {
		b, err := q.GetBookingForUpdate(ctx, bookingID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.ErrNotFound
			}
			return err
		}
		if err := db.AdvisoryXactLock(ctx, tx, b.RoomID.String()); err != nil {
			return err
		}
		cancelled, err = cancelConflicting(ctx, q, b.RoomID, bookingID, b.StartsAt, b.EndsAt, adminID)
		if err != nil {
			return err
		}
		row, err := q.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{
			ID: bookingID, Status: dbgen.BookingStatusAPPROVED, ReviewedBy: &adminID, ReviewNote: note,
		})
		if err != nil {
			return db.MapError(err)
		}
		approved = viewFromStatus(row)
		return nil
	})
	if err != nil {
		return BookingView{}, nil, err
	}
	for _, c := range cancelled {
		s.notifier.BookingEvent("BOOKING_CANCELLED", c)
	}
	s.notifier.BookingEvent("BOOKING_APPROVED", approved)
	return approved, cancelled, nil
}

// Get returns a booking by id.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (dbgen.GetBookingRow, error) {
	return s.store.GetBooking(ctx, id)
}

// List returns bookings matching the params (role scoping applied by caller).
func (s *Service) List(ctx context.Context, p dbgen.ListBookingsParams) ([]BookingView, error) {
	rows, err := s.store.ListBookings(ctx, p)
	if err != nil {
		return nil, err
	}
	views := make([]BookingView, len(rows))
	for i, r := range rows {
		views[i] = viewFromList(r)
	}
	return views, nil
}

func (s *Service) getStatus(ctx context.Context, id uuid.UUID) (dbgen.BookingStatus, error) {
	b, err := s.store.GetBooking(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.ErrNotFound
		}
		return "", err
	}
	return b.Status, nil
}

// cancelConflicting cancels the approved bookings overlapping the window for a
// room (used by admin override, BR6) and returns their views.
func cancelConflicting(ctx context.Context, q *dbgen.Queries, roomID, excludeID uuid.UUID, winStart, winEnd pgtype.Timestamptz, adminID uuid.UUID) ([]BookingView, error) {
	conflicts, err := q.ListConflictingApprovedBookings(ctx, dbgen.ListConflictingApprovedBookingsParams{
		RoomID: roomID, ExcludeID: excludeID, WinStart: winStart, WinEnd: winEnd,
	})
	if err != nil {
		return nil, err
	}
	var cancelled []BookingView
	for _, c := range conflicts {
		row, err := q.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{
			ID: c.ID, Status: dbgen.BookingStatusCANCELLED, ReviewedBy: &adminID,
			ReviewNote: ptr("cancelled by administrative override"),
		})
		if err != nil {
			return nil, db.MapError(err)
		}
		cancelled = append(cancelled, viewFromStatus(row))
	}
	return cancelled, nil
}

func ptr[T any](v T) *T { return &v }

// minutesInto returns the minutes from the local day's midnight to t.
func minutesInto(t, day time.Time) int { return int(t.Sub(day).Minutes()) }
