package httpx

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

// Page is the cursor-paginated envelope (§8.1).
type Page[T any] struct {
	Data       []T     `json:"data"`
	NextCursor *string `json:"next_cursor"`
}

// NewPage builds a page, computing next_cursor from the last item's id when the
// page is full. idOf extracts the opaque cursor (the row id) from an item.
func NewPage[T any](items []T, limit int, idOf func(T) uuid.UUID) Page[T] {
	p := Page[T]{Data: items}
	if len(items) == int(limit) && len(items) > 0 {
		c := idOf(items[len(items)-1]).String()
		p.NextCursor = &c
	}
	if p.Data == nil {
		p.Data = []T{}
	}
	return p
}

// Limit parses ?limit= within [1, maxLimit], defaulting to 50.
func Limit(r *http.Request) int {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return defaultLimit
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return defaultLimit
	}
	if n > maxLimit {
		return maxLimit
	}
	return n
}

// Cursor parses ?cursor= as a UUID, returning nil when absent/invalid.
func Cursor(r *http.Request) *uuid.UUID {
	v := r.URL.Query().Get("cursor")
	if v == "" {
		return nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil
	}
	return &id
}
