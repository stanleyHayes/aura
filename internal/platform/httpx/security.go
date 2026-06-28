package httpx

import (
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/auth"
)

// SecurityHeaders sets the baseline response headers from §14. HSTS is only sent
// over TLS (production). The CSP here is API-appropriate (no inline scripts); the
// web app sets its own nonce-based CSP.
func SecurityHeaders(production bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			if production {
				h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// rateLimiter is a fixed-window in-memory limiter. It is correct for a single
// instance; for multiple API replicas, back it with Redis (redis_rate) behind the
// same middleware surface (§8.1, §14, ADR-0002).
type rateLimiter struct {
	mu      sync.Mutex
	windows map[string]*window
	limit   int
	per     time.Duration
}

type window struct {
	count int
	reset time.Time
}

func newRateLimiter(limit int, per time.Duration) *rateLimiter {
	rl := &rateLimiter{windows: map[string]*window{}, limit: limit, per: per}
	return rl
}

func (rl *rateLimiter) take(key string, now time.Time) (allowed bool, remaining int, reset time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	w, ok := rl.windows[key]
	if !ok || now.After(w.reset) {
		w = &window{count: 0, reset: now.Add(rl.per)}
		rl.windows[key] = w
		if len(rl.windows) > 100_000 { // crude bound; evict on overflow
			rl.windows = map[string]*window{key: w}
		}
	}
	w.count++
	remaining = rl.limit - w.count
	if remaining < 0 {
		remaining = 0
	}
	return w.count <= rl.limit, remaining, w.reset
}

// RateLimit limits requests per key (authenticated user id, else client IP).
// Sets the IETF draft RateLimit-* headers and returns 429 on exceed.
func RateLimit(limit int, per time.Duration, log *slog.Logger) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, per)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := rateKey(r)
			ok, remaining, reset := rl.take(key, time.Now())
			w.Header().Set("RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("RateLimit-Remaining", strconv.Itoa(remaining))
			w.Header().Set("RateLimit-Reset", strconv.Itoa(int(time.Until(reset).Seconds())))
			if !ok {
				w.Header().Set("Retry-After", strconv.Itoa(int(time.Until(reset).Seconds())))
				Error(w, r, log, apperr.New(http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateKey(r *http.Request) string {
	if id, ok := auth.FromContext(r.Context()); ok {
		return "u:" + id.UserID.String()
	}
	if ip := ClientIP(r); ip != nil {
		return "ip:" + *ip
	}
	return "ip:unknown"
}
