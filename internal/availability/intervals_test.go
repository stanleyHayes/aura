package availability

import (
	"reflect"
	"testing"
)

// The spec (§7.1) mandates coverage of: no occupancy, full occupancy, partial
// overlaps at both edges, adjacency (touching but not overlapping must remain
// free), and identical boundaries. This file aims at ~100% of the interval math.

func TestMerge(t *testing.T) {
	tests := []struct {
		name string
		in   []Interval
		want []Interval
	}{
		{"empty", nil, nil},
		{"single", []Interval{{600, 720}}, []Interval{{600, 720}}},
		{"drops invalid", []Interval{{600, 600}, {700, 650}, {480, 540}}, []Interval{{480, 540}}},
		{"disjoint sorted", []Interval{{480, 540}, {600, 660}}, []Interval{{480, 540}, {600, 660}}},
		{"disjoint unsorted", []Interval{{600, 660}, {480, 540}}, []Interval{{480, 540}, {600, 660}}},
		{"overlapping", []Interval{{480, 600}, {540, 660}}, []Interval{{480, 660}}},
		{"adjacent merge", []Interval{{480, 600}, {600, 720}}, []Interval{{480, 720}}},
		{"contained", []Interval{{480, 720}, {540, 600}}, []Interval{{480, 720}}},
		{"identical", []Interval{{480, 600}, {480, 600}}, []Interval{{480, 600}}},
		{"chain", []Interval{{0, 60}, {60, 120}, {120, 180}}, []Interval{{0, 180}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Merge(tt.in)
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("Merge(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestOverlaps(t *testing.T) {
	tests := []struct {
		name string
		a, b Interval
		want bool
	}{
		{"disjoint", Interval{480, 540}, Interval{600, 660}, false},
		{"adjacent touching is NOT overlap", Interval{480, 600}, Interval{600, 720}, false},
		{"adjacent reversed", Interval{600, 720}, Interval{480, 600}, false},
		{"partial left", Interval{480, 600}, Interval{540, 660}, true},
		{"partial right", Interval{540, 660}, Interval{480, 600}, true},
		{"identical", Interval{480, 600}, Interval{480, 600}, true},
		{"contained", Interval{480, 720}, Interval{540, 600}, true},
		{"shared start", Interval{480, 600}, Interval{480, 540}, true},
		{"shared end", Interval{540, 600}, Interval{480, 600}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Overlaps(tt.a, tt.b); got != tt.want {
				t.Fatalf("Overlaps(%v,%v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestSubtract(t *testing.T) {
	win := Interval{480, 720} // 08:00–12:00
	tests := []struct {
		name     string
		occupied []Interval
		want     []Interval
	}{
		{"no occupancy", nil, []Interval{{480, 720}}},
		{"full occupancy", []Interval{{480, 720}}, []Interval{}},
		{"over-full occupancy", []Interval{{400, 800}}, []Interval{}},
		{"middle block", []Interval{{540, 600}}, []Interval{{480, 540}, {600, 720}}},
		{"left edge", []Interval{{480, 540}}, []Interval{{540, 720}}},
		{"right edge", []Interval{{660, 720}}, []Interval{{480, 660}}},
		{"adjacent before window stays free", []Interval{{420, 480}}, []Interval{{480, 720}}},
		{"adjacent after window stays free", []Interval{{720, 780}}, []Interval{{480, 720}}},
		{"two blocks", []Interval{{510, 540}, {600, 630}}, []Interval{{480, 510}, {540, 600}, {630, 720}}},
		{"overlapping occupied merged", []Interval{{510, 600}, {540, 660}}, []Interval{{480, 510}, {660, 720}}},
		{"occupied spilling left", []Interval{{420, 540}}, []Interval{{540, 720}}},
		{"occupied spilling right", []Interval{{660, 800}}, []Interval{{480, 660}}},
		{"identical boundary at start", []Interval{{480, 600}}, []Interval{{600, 720}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Subtract(win, tt.occupied)
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("Subtract(%v,%v) = %v, want %v", win, tt.occupied, got, tt.want)
			}
		})
	}
}

func TestSubtractInvalidWindow(t *testing.T) {
	if got := Subtract(Interval{600, 600}, nil); got != nil {
		t.Fatalf("expected nil for invalid window, got %v", got)
	}
}

func TestFullyFreeAndCovers(t *testing.T) {
	win := Interval{600, 720} // 10:00–12:00
	tests := []struct {
		name      string
		occupied  []Interval
		fullyFree bool
	}{
		{"empty", nil, true},
		{"lecture ends exactly at start (adjacent)", []Interval{{480, 600}}, true},
		{"booking starts exactly at end (adjacent)", []Interval{{720, 840}}, true},
		{"overlap at start", []Interval{{540, 660}}, false},
		{"overlap at end", []Interval{{660, 780}}, false},
		{"fully inside", []Interval{{630, 660}}, false},
		{"exact match", []Interval{{600, 720}}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ff := FullyFree(win, tt.occupied)
			if ff != tt.fullyFree {
				t.Fatalf("FullyFree = %v, want %v", ff, tt.fullyFree)
			}
			// Covers must agree with FullyFree for the entire window.
			cov := Covers(Subtract(win, tt.occupied), win)
			if cov != tt.fullyFree {
				t.Fatalf("Covers = %v, want %v (must agree with FullyFree)", cov, tt.fullyFree)
			}
		})
	}
}

// The canonical example from the source requirements (§7.6): room A101 Monday
// 08:00–10:00 occupied by a lecture; free before and after.
func TestCanonicalExample(t *testing.T) {
	day := Interval{0, 1440}
	lecture := []Interval{{480, 600}} // 08:00–10:00
	free := Subtract(day, lecture)
	want := []Interval{{0, 480}, {600, 1440}}
	if !reflect.DeepEqual(free, want) {
		t.Fatalf("free = %v, want %v", free, want)
	}
	if FullyFree(Interval{480, 600}, lecture) {
		t.Fatal("08:00–10:00 must NOT be free")
	}
	if !FullyFree(Interval{600, 720}, lecture) {
		t.Fatal("10:00–12:00 must be free")
	}
}
