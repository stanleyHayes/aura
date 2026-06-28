// Package availability is the read-only engine that derives room availability
// from lectures (active semester), approved bookings, and maintenance windows
// (§7.1, §7.6). The interval arithmetic here is pure and exhaustively tested;
// it is the technical core of the system.
package availability

import "sort"

// Interval is a half-open range of minutes from midnight: [Start, End).
// Half-open is deliberate: a lecture ending at 10:00 and a booking starting at
// 10:00 touch but do NOT overlap, so the room is free from 10:00 (§7.1 adjacency).
type Interval struct {
	Start int `json:"start"` // minutes from midnight, inclusive
	End   int `json:"end"`   // minutes from midnight, exclusive
}

// Valid reports whether the interval is non-empty and well-ordered.
func (i Interval) Valid() bool { return i.End > i.Start }

// Overlaps reports a strict (non-adjacent) overlap between two intervals.
func Overlaps(a, b Interval) bool { return a.Start < b.End && b.Start < a.End }

// Merge sorts and coalesces overlapping or adjacent intervals into the minimal
// set of disjoint intervals. Empty/invalid inputs are dropped.
func Merge(in []Interval) []Interval {
	cleaned := make([]Interval, 0, len(in))
	for _, iv := range in {
		if iv.Valid() {
			cleaned = append(cleaned, iv)
		}
	}
	if len(cleaned) == 0 {
		return nil
	}
	sort.Slice(cleaned, func(i, j int) bool {
		if cleaned[i].Start != cleaned[j].Start {
			return cleaned[i].Start < cleaned[j].Start
		}
		return cleaned[i].End < cleaned[j].End
	})
	out := []Interval{cleaned[0]}
	for _, iv := range cleaned[1:] {
		last := &out[len(out)-1]
		if iv.Start <= last.End { // overlapping or adjacent
			if iv.End > last.End {
				last.End = iv.End
			}
			continue
		}
		out = append(out, iv)
	}
	return out
}

// Subtract returns the free sub-intervals of window that are not covered by any
// occupied interval. Occupied intervals are clamped to the window first.
func Subtract(window Interval, occupied []Interval) []Interval {
	if !window.Valid() {
		return nil
	}
	merged := Merge(occupied)
	free := []Interval{}
	cursor := window.Start
	for _, occ := range merged {
		// Clamp to the window.
		s, e := occ.Start, occ.End
		if e <= window.Start || s >= window.End {
			continue // entirely outside the window
		}
		if s < window.Start {
			s = window.Start
		}
		if e > window.End {
			e = window.End
		}
		if s > cursor {
			free = append(free, Interval{Start: cursor, End: s})
		}
		if e > cursor {
			cursor = e
		}
	}
	if cursor < window.End {
		free = append(free, Interval{Start: cursor, End: window.End})
	}
	return free
}

// Covers reports whether the free set fully covers the window (i.e. the window is
// entirely free). True iff Subtract(window, occupied) yields exactly the window.
func Covers(free []Interval, window Interval) bool {
	return len(free) == 1 && free[0] == window
}

// FullyFree reports whether no occupied interval overlaps the window — the
// condition for including a room in a search for the entire window (§7.1).
func FullyFree(window Interval, occupied []Interval) bool {
	for _, occ := range occupied {
		if Overlaps(window, occ) {
			return false
		}
	}
	return true
}
