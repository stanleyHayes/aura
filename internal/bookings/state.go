// Package bookings owns the booking request lifecycle, conflict detection, and
// the concurrency-safe approval path (§7.2, §7.3). The database is the source of
// truth for "is this slot taken" — the partial EXCLUDE constraint and the
// validation trigger are the guarantees; this code is the workflow around them.
package bookings

import "github.com/aura/cbs/internal/platform/db/dbgen"

// allowed encodes the booking state machine (§7.2). Terminal states have no
// outgoing transitions.
var allowed = map[dbgen.BookingStatus]map[dbgen.BookingStatus]bool{
	dbgen.BookingStatusPENDING: {
		dbgen.BookingStatusAPPROVED:  true,
		dbgen.BookingStatusREJECTED:  true,
		dbgen.BookingStatusCANCELLED: true,
		dbgen.BookingStatusEXPIRED:   true,
	},
	dbgen.BookingStatusAPPROVED: {
		dbgen.BookingStatusCANCELLED: true,
	},
}

// CanTransition reports whether from→to is a legal booking transition.
func CanTransition(from, to dbgen.BookingStatus) bool {
	return allowed[from][to]
}
