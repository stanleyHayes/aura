package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
)

func TestLimit(t *testing.T) {
	mk := func(q string) *http.Request { return httptest.NewRequest("GET", "/?"+q, nil) }
	if got := Limit(mk("")); got != 50 {
		t.Errorf("default = %d, want 50", got)
	}
	if got := Limit(mk("limit=10")); got != 10 {
		t.Errorf("= %d, want 10", got)
	}
	if got := Limit(mk("limit=99999")); got != 200 {
		t.Errorf("clamp = %d, want 200", got)
	}
	if got := Limit(mk("limit=abc")); got != 50 {
		t.Errorf("invalid = %d, want 50", got)
	}
}

func TestCursor(t *testing.T) {
	if Cursor(httptest.NewRequest("GET", "/", nil)) != nil {
		t.Error("empty cursor must be nil")
	}
	if Cursor(httptest.NewRequest("GET", "/?cursor=not-a-uuid", nil)) != nil {
		t.Error("invalid cursor must be nil")
	}
	id := uuid.New()
	got := Cursor(httptest.NewRequest("GET", "/?cursor="+id.String(), nil))
	if got == nil || *got != id {
		t.Errorf("cursor = %v, want %v", got, id)
	}
}

func TestNewPage(t *testing.T) {
	type row struct{ ID uuid.UUID }
	idOf := func(r row) uuid.UUID { return r.ID }

	// Empty → non-nil empty slice, nil cursor.
	p := NewPage[row](nil, 50, idOf)
	if p.Data == nil || len(p.Data) != 0 || p.NextCursor != nil {
		t.Fatalf("empty page = %+v", p)
	}
	// Partial page (< limit) → nil cursor.
	p = NewPage([]row{{uuid.New()}}, 50, idOf)
	if p.NextCursor != nil {
		t.Fatal("partial page must have nil next_cursor")
	}
	// Full page → next_cursor is the last id.
	last := uuid.New()
	p = NewPage([]row{{uuid.New()}, {last}}, 2, idOf)
	if p.NextCursor == nil || *p.NextCursor != last.String() {
		t.Fatalf("full page next_cursor = %v, want %v", p.NextCursor, last)
	}
}

func TestSlugify(t *testing.T) {
	if got := slugify("SLOT_NO_LONGER_AVAILABLE"); got != "slot-no-longer-available" {
		t.Fatalf("slugify = %q", got)
	}
}

func TestErrorWritesProblemJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/bookings/x/approve", nil)
	Error(rec, req, testLogger(), apperr.ErrSlotUnavailable)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("content-type = %q", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"code":"SLOT_NO_LONGER_AVAILABLE"`) {
		t.Fatalf("body missing code: %s", body)
	}
	if !strings.Contains(body, `"instance":"/api/v1/bookings/x/approve"`) {
		t.Fatalf("body missing instance: %s", body)
	}
}

func TestErrorMapsUnknownToInternal(t *testing.T) {
	rec := httptest.NewRecorder()
	Error(rec, httptest.NewRequest("GET", "/", nil), testLogger(), errString("boom"))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestDecodeJSON(t *testing.T) {
	type body struct {
		Name string `json:"name"`
	}
	// Valid.
	var b body
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"x"}`))
	if err := DecodeJSON(req, &b); err != nil || b.Name != "x" {
		t.Fatalf("valid decode failed: %v", err)
	}
	// Unknown field rejected.
	req = httptest.NewRequest("POST", "/", strings.NewReader(`{"nope":1}`))
	if err := DecodeJSON(req, &body{}); err == nil {
		t.Fatal("unknown field must error")
	}
	// Malformed JSON rejected.
	req = httptest.NewRequest("POST", "/", strings.NewReader(`{not json`))
	if err := DecodeJSON(req, &body{}); err == nil {
		t.Fatal("malformed json must error")
	}
}

type errString string

func (e errString) Error() string { return string(e) }
