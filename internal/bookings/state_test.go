package bookings

import (
	"testing"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestCanTransition(t *testing.T) {
	legal := []struct{ from, to dbgen.BookingStatus }{
		{dbgen.BookingStatusPENDING, dbgen.BookingStatusAPPROVED},
		{dbgen.BookingStatusPENDING, dbgen.BookingStatusREJECTED},
		{dbgen.BookingStatusPENDING, dbgen.BookingStatusCANCELLED},
		{dbgen.BookingStatusPENDING, dbgen.BookingStatusEXPIRED},
		{dbgen.BookingStatusAPPROVED, dbgen.BookingStatusCANCELLED},
	}
	for _, c := range legal {
		if !CanTransition(c.from, c.to) {
			t.Errorf("expected %s→%s to be legal", c.from, c.to)
		}
	}

	illegal := []struct{ from, to dbgen.BookingStatus }{
		{dbgen.BookingStatusAPPROVED, dbgen.BookingStatusREJECTED},
		{dbgen.BookingStatusAPPROVED, dbgen.BookingStatusAPPROVED},
		{dbgen.BookingStatusREJECTED, dbgen.BookingStatusAPPROVED},
		{dbgen.BookingStatusCANCELLED, dbgen.BookingStatusAPPROVED},
		{dbgen.BookingStatusEXPIRED, dbgen.BookingStatusAPPROVED},
		{dbgen.BookingStatusPENDING, dbgen.BookingStatusPENDING},
	}
	for _, c := range illegal {
		if CanTransition(c.from, c.to) {
			t.Errorf("expected %s→%s to be illegal", c.from, c.to)
		}
	}
}
