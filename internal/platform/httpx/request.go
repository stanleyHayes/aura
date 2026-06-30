package httpx

import (
	"net"
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
)

// trustedProxyCount is the configured number of trusted reverse-proxy hops in
// front of the API, set once at startup via SetTrustedProxyCount. Stored as an
// atomic so tests can adjust it without a data race with concurrent handlers.
var trustedProxyCount atomic.Int32

// SetTrustedProxyCount configures how X-Forwarded-For is interpreted (MED-4).
// Call once at startup. A count <= 0 means XFF is untrusted (ignored entirely).
func SetTrustedProxyCount(n int) { trustedProxyCount.Store(int32(n)) }

// remoteHost returns the host portion of r.RemoteAddr, or "" if unavailable.
func remoteHost(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return host
}

// ClientIP returns the best-effort client IP, hardened against X-Forwarded-For
// spoofing (MED-4). With TRUSTED_PROXY_COUNT <= 0 the XFF header is ignored and
// the direct connection (RemoteAddr) is used. With a positive count N, the client
// as seen by the outermost trusted proxy is the entry N positions from the RIGHT
// of the XFF list; anything an untrusted client prepends is to the left and so is
// ignored. Falls back to RemoteAddr when XFF is missing or too short.
func ClientIP(r *http.Request) *string {
	count := int(trustedProxyCount.Load())
	if count > 0 {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			for i := range parts {
				parts[i] = strings.TrimSpace(parts[i])
			}
			// The rightmost entry was added by our nearest proxy; stepping `count`
			// from the right lands on the client as seen by the outermost trusted
			// proxy. If the client sent fewer entries, fall back to RemoteAddr.
			idx := len(parts) - count
			if idx >= 0 && idx < len(parts) && parts[idx] != "" {
				host := parts[idx]
				return &host
			}
		}
	}
	host := remoteHost(r)
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
