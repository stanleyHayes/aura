package scheduling

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// ParseClock normalises common spreadsheet time formats to 24-hour (hour, min).
// Accepts "08:00", "8:00 AM", "0800", "8:00", "14:30", "2:30 pm". Rejects
// ambiguous or malformed values rather than guessing (§7.5).
func ParseClock(s string) (hour, min int, err error) {
	raw := strings.ToUpper(strings.TrimSpace(s))
	if raw == "" {
		return 0, 0, fmt.Errorf("empty time")
	}

	ampm := ""
	switch {
	case strings.HasSuffix(raw, "AM"):
		ampm, raw = "AM", strings.TrimSpace(strings.TrimSuffix(raw, "AM"))
	case strings.HasSuffix(raw, "PM"):
		ampm, raw = "PM", strings.TrimSpace(strings.TrimSuffix(raw, "PM"))
	}

	if strings.Contains(raw, ":") {
		parts := strings.Split(raw, ":")
		if len(parts) != 2 {
			return 0, 0, fmt.Errorf("invalid time %q", s)
		}
		hour, err = strconv.Atoi(parts[0])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid hour in %q", s)
		}
		min, err = strconv.Atoi(strings.TrimSpace(parts[1]))
		if err != nil {
			return 0, 0, fmt.Errorf("invalid minute in %q", s)
		}
	} else {
		// Compact digits: HMM, HHMM (e.g. 800, 0800, 1430).
		if _, e := strconv.Atoi(raw); e != nil {
			return 0, 0, fmt.Errorf("invalid time %q", s)
		}
		switch len(raw) {
		case 3:
			hour, _ = strconv.Atoi(raw[:1])
			min, _ = strconv.Atoi(raw[1:])
		case 4:
			hour, _ = strconv.Atoi(raw[:2])
			min, _ = strconv.Atoi(raw[2:])
		default:
			return 0, 0, fmt.Errorf("ambiguous time %q", s)
		}
	}

	switch ampm {
	case "AM":
		if hour < 1 || hour > 12 {
			return 0, 0, fmt.Errorf("invalid 12-hour value %q", s)
		}
		if hour == 12 {
			hour = 0
		}
	case "PM":
		if hour < 1 || hour > 12 {
			return 0, 0, fmt.Errorf("invalid 12-hour value %q", s)
		}
		if hour != 12 {
			hour += 12
		}
	}

	if hour < 0 || hour > 23 || min < 0 || min > 59 {
		return 0, 0, fmt.Errorf("time out of range %q", s)
	}
	return hour, min, nil
}

// ParseDay maps day labels to the day_of_week enum. Accepts MON/MONDAY and the
// three-letter forms; rejects ambiguous single letters.
func ParseDay(s string) (dbgen.DayOfWeek, error) {
	v := strings.ToUpper(strings.TrimSpace(s))
	switch v {
	case "MON", "MONDAY":
		return dbgen.DayOfWeekMON, nil
	case "TUE", "TUES", "TUESDAY":
		return dbgen.DayOfWeekTUE, nil
	case "WED", "WEDS", "WEDNESDAY":
		return dbgen.DayOfWeekWED, nil
	case "THU", "THUR", "THURS", "THURSDAY":
		return dbgen.DayOfWeekTHU, nil
	case "FRI", "FRIDAY":
		return dbgen.DayOfWeekFRI, nil
	case "SAT", "SATURDAY":
		return dbgen.DayOfWeekSAT, nil
	case "SUN", "SUNDAY":
		return dbgen.DayOfWeekSUN, nil
	default:
		return "", fmt.Errorf("unrecognised day %q", s)
	}
}
