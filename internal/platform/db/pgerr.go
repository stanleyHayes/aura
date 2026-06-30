package db

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/aura/cbs/internal/platform/apperr"
)

// MapError translates Postgres errors raised by the booking constraints and the
// validation trigger (§6.6, §6.7) into stable application errors. This is what
// makes the database the source of truth while clients still get a clean code.
func MapError(err error) error {
	if err == nil {
		return nil
	}
	var pg *pgconn.PgError
	if !errors.As(err, &pg) {
		return err
	}
	switch pg.Code {
	case "23P01": // exclusion_violation
		switch pg.ConstraintName {
		case "excl_booking_overlap":
			return apperr.ErrSlotUnavailable
		case "excl_tt_overlap":
			return apperr.ErrConflict.WithDetail("lecture overlaps an existing event in this room/day")
		case "excl_maint_overlap":
			return apperr.ErrConflict.WithDetail("maintenance window overlaps an existing window")
		default:
			return apperr.ErrConflict
		}
	case "23505": // unique_violation
		if pg.ConstraintName == "uq_one_active_semester" {
			return apperr.ErrActiveSemesterExists
		}
		return apperr.ErrConflict.WithDetail("a record with the same unique key already exists")
	case "23503": // foreign_key_violation
		return apperr.ErrValidation.WithDetail("referenced record does not exist")
	case "23514": // check_violation
		return apperr.ErrValidation.WithDetail("a value violates a constraint: %s", pg.ConstraintName)
	case "P0001": // raise_exception (trigger)
		return mapTriggerMessage(pg.Message)
	}
	return err
}

func mapTriggerMessage(msg string) error {
	switch msg {
	case "BOOKING_IN_PAST":
		return apperr.ErrBookingInPast
	case "BOOKING_SPANS_MULTIPLE_DAYS":
		return apperr.ErrBookingSpansDays
	case "ATTENDEES_EXCEED_CAPACITY":
		return apperr.ErrAttendeesExceed
	case "CONFLICTS_WITH_LECTURE":
		return apperr.ErrConflictsLecture
	case "CONFLICTS_WITH_MAINTENANCE":
		return apperr.ErrConflictsMaintenance
	case "CONFLICTS_WITH_APPROVED_BOOKING":
		// LOW-12: creating/moving a maintenance window over an approved booking.
		return apperr.ErrMaintenanceConflict
	default:
		return apperr.ErrUnprocessable.WithDetail("%s", msg)
	}
}
