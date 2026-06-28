package scheduling

import "testing"

func TestParseClock(t *testing.T) {
	ok := []struct {
		in   string
		h, m int
	}{
		{"08:00", 8, 0},
		{"8:00", 8, 0},
		{"0800", 8, 0},
		{"800", 8, 0},
		{"8:00 AM", 8, 0},
		{"12:00 AM", 0, 0},
		{"12:00 PM", 12, 0},
		{"2:30 pm", 14, 30},
		{"14:30", 14, 30},
		{"1430", 14, 30},
		{"23:59", 23, 59},
	}
	for _, tt := range ok {
		h, m, err := ParseClock(tt.in)
		if err != nil || h != tt.h || m != tt.m {
			t.Errorf("ParseClock(%q) = %d:%d, %v; want %d:%d", tt.in, h, m, err, tt.h, tt.m)
		}
	}

	bad := []string{"", "abc", "25:00", "12:60", "8", "08:0:0", "13:00 PM", "0:00 AM", "99999"}
	for _, in := range bad {
		if _, _, err := ParseClock(in); err == nil {
			t.Errorf("ParseClock(%q) should have errored", in)
		}
	}
}

func TestParseDay(t *testing.T) {
	cases := map[string]string{
		"Mon": "MON", "monday": "MON", "TUESDAY": "TUE", "Weds": "WED",
		"thur": "THU", "FRI": "FRI", "Saturday": "SAT", "sun": "SUN",
	}
	for in, want := range cases {
		got, err := ParseDay(in)
		if err != nil || string(got) != want {
			t.Errorf("ParseDay(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "M", "funday", "xyz"} {
		if _, err := ParseDay(in); err == nil {
			t.Errorf("ParseDay(%q) should have errored", in)
		}
	}
}
