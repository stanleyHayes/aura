package httpx

import (
	"net"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
)

// ClientIP returns the best-effort client IP (honouring X-Forwarded-For from the
// trusted ingress/CDN), or nil.
func ClientIP(r *http.Request) *string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		host := xff
		if i := indexByte(xff, ','); i >= 0 {
			host = xff[:i]
		}
		host = trimSpace(host)
		if host != "" {
			return &host
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if host == "" {
		return nil
	}
	return &host
}

// UserAgentPtr returns the User-Agent header or nil.
func UserAgentPtr(r *http.Request) *string {
	ua := r.UserAgent()
	if ua == "" {
		return nil
	}
	return &ua
}

// PathUUID parses a chi URL parameter as a UUID.
func PathUUID(r *http.Request, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.ErrValidation.WithDetail("invalid %s: must be a UUID", name)
	}
	return id, nil
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
