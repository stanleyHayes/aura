package pgconv

import (
	"testing"
	"time"
)

func TestTimestamptzRoundTrip(t *testing.T) {
	now := time.Date(2026, 6, 28, 14, 30, 0, 0, time.UTC)
	ts := TS(now)
	if !ts.Valid || !ts.Time.Equal(now) {
		t.Fatalf("TS round-trip failed: %+v", ts)
	}
	if p := TimePtr(ts); p == nil || !p.Equal(now) {
		t.Fatalf("TimePtr = %v", p)
	}
	if Time(ts) != now {
		t.Fatal("Time mismatch")
	}
	var invalid = TS(now)
	invalid.Valid = false
	if TimePtr(invalid) != nil {
		t.Fatal("TimePtr of invalid must be nil")
	}
}

func TestDateRoundTrip(t *testing.T) {
	d := time.Date(2026, 1, 13, 0, 0, 0, 0, time.UTC)
	if got := DateVal(Date(d)); !got.Equal(d) {
		t.Fatalf("Date round-trip = %v, want %v", got, d)
	}
}

func TestInterval(t *testing.T) {
	iv := Interval(15 * time.Minute)
	if !iv.Valid || iv.Microseconds != int64(15*time.Minute/time.Microsecond) {
		t.Fatalf("Interval = %+v", iv)
	}
}

func TestClockConversions(t *testing.T) {
	cases := [][2]int{{8, 0}, {14, 30}, {0, 0}, {23, 59}}
	for _, c := range cases {
		pt := ClockToPgTime(c[0], c[1], 0)
		h, m := PgTimeToClock(pt)
		if h != c[0] || m != c[1] {
			t.Errorf("ClockToPgTime/PgTimeToClock %v -> %d:%d", c, h, m)
		}
	}
}
