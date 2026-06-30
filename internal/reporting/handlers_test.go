package reporting

import (
	"log/slog"
	"net/http/httptest"
	"testing"

	"github.com/aura/cbs/internal/platform/apperr"
)

func TestCSVSafe(t *testing.T) {
	cases := map[string]string{
		"=cmd|' /C calc'!A1": "'=cmd|' /C calc'!A1",
		"+1+1":               "'+1+1",
		"-2+3":               "'-2+3",
		"@SUM(A1)":           "'@SUM(A1)",
		"\tTabbed":           "'\tTabbed",
		"\rCarriage":         "'\rCarriage",
		"LH-101":             "LH-101",
		"Normal Name":        "Normal Name",
		"":                   "",
	}
	for in, want := range cases {
		if got := csvSafe(in); got != want {
			t.Errorf("csvSafe(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseFilterDateRange(t *testing.T) {
	h := &Handler{log: slog.New(slog.DiscardHandler)}

	// To before From → validation error.
	r1 := httptest.NewRequest("GET", "/reports/utilisation?from=2026-06-01&to=2026-05-01", nil)
	if _, err := h.parseFilter(r1); err == nil {
		t.Fatal("expected an error when 'to' precedes 'from'")
	} else if ae, ok := apperr.As(err); !ok || ae.Status != 400 {
		t.Fatalf("want 400 validation error, got %v", err)
	}

	// Range exceeding the cap → 422.
	r2 := httptest.NewRequest("GET", "/reports/utilisation?from=2020-01-01&to=2026-01-01", nil)
	if _, err := h.parseFilter(r2); err == nil {
		t.Fatal("expected an error when the range exceeds the cap")
	} else if ae, ok := apperr.As(err); !ok || ae.Status != 422 {
		t.Fatalf("want 422 unprocessable error, got %v", err)
	}

	// A reasonable range is accepted.
	r3 := httptest.NewRequest("GET", "/reports/utilisation?from=2026-01-01&to=2026-03-01", nil)
	if _, err := h.parseFilter(r3); err != nil {
		t.Fatalf("valid range should parse: %v", err)
	}
}
