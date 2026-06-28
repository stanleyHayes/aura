// Package pgconv converts between Go time values and the pgtype values produced
// by the sqlc-generated layer. Centralising this keeps the modules readable.
package pgconv

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// TS wraps a time.Time as a valid pgtype.Timestamptz.
func TS(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }

// TimePtr returns the time if valid, else nil.
func TimePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}

// Time returns the time (zero if invalid).
func Time(ts pgtype.Timestamptz) time.Time { return ts.Time }

// Date wraps a time.Time as a pgtype.Date.
func Date(t time.Time) pgtype.Date { return pgtype.Date{Time: t, Valid: true} }

// DateVal returns the date as time.Time.
func DateVal(d pgtype.Date) time.Time { return d.Time }

// Interval builds a pgtype.Interval from a duration (microsecond precision).
func Interval(d time.Duration) pgtype.Interval {
	return pgtype.Interval{Microseconds: d.Microseconds(), Valid: true}
}

// PgTimeToClock converts a pgtype.Time (microseconds since midnight) to hh, mm.
func PgTimeToClock(t pgtype.Time) (hour, min int) {
	total := t.Microseconds / 1_000_000 // seconds
	hour = int(total / 3600)
	min = int((total % 3600) / 60)
	return hour, min
}

// ClockToPgTime builds a pgtype.Time from a wall-clock hh:mm:ss.
func ClockToPgTime(hour, min, sec int) pgtype.Time {
	micros := int64((hour*3600 + min*60 + sec)) * 1_000_000
	return pgtype.Time{Microseconds: micros, Valid: true}
}
