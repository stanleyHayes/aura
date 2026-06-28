package httpx

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/logging"
	"github.com/aura/cbs/internal/platform/rbac"
)

// accessCookieValue reads the access token from either cookie name (§9.2).
func accessCookieValue(r *http.Request) string {
	for _, name := range []string{prodAccessCookie, devAccessCookie} {
		if c, err := r.Cookie(name); err == nil && c.Value != "" {
			return c.Value
		}
	}
	return ""
}

// Recoverer converts panics into 500 problem responses.
func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logging.FromContext(r.Context(), log).Error("panic recovered", "panic", rec, "path", r.URL.Path)
					Error(w, r, log, apperr.ErrInternal)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Correlation attaches a correlation id to the context and response header (§15).
func Correlation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Correlation-ID")
		if id == "" {
			id = uuid.NewString()
		}
		w.Header().Set("X-Correlation-ID", id)
		next.ServeHTTP(w, r.WithContext(logging.WithCorrelation(r.Context(), id)))
	})
}

// AccessLog logs one structured line per request (RED metrics feed; §15).
func AccessLog(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: 200}
			next.ServeHTTP(sw, r)
			logging.FromContext(r.Context(), log).Info("http_request",
				"method", r.Method, "path", r.URL.Path,
				"status", sw.status, "duration_ms", time.Since(start).Milliseconds())
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// Flush exposes http.Flusher for SSE streaming.
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Authenticator verifies the access token (cookie or bearer) and populates the
// request identity. Requests without a valid token are rejected with 401.
func Authenticator(signer auth.TokenSigner, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := bearerToken(r)
			if tok == "" {
				tok = accessCookieValue(r)
			}
			if tok == "" {
				Error(w, r, log, apperr.ErrUnauthorized)
				return
			}
			claims, err := signer.Verify(tok)
			if err != nil {
				Error(w, r, log, apperr.ErrInvalidToken)
				return
			}
			uid, err := uuid.Parse(claims.Subject)
			if err != nil {
				Error(w, r, log, apperr.ErrInvalidToken)
				return
			}
			id := auth.Identity{UserID: uid, Role: claims.Role, Email: claims.Email}
			next.ServeHTTP(w, r.WithContext(auth.WithIdentity(r.Context(), id)))
		})
	}
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}

// CSRF enforces a double-submit token on unsafe methods for cookie-authenticated
// requests (§9.2). Bearer-token (API/mobile) requests are exempt — they cannot be
// driven by a browser's ambient cookies.
func CSRF(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			if bearerToken(r) != "" { // API/mobile client, not cookie-driven
				next.ServeHTTP(w, r)
				return
			}
			cookie := ""
			for _, name := range []string{prodCSRFCookie, devCSRFCookie} {
				if c, err := r.Cookie(name); err == nil {
					cookie = c.Value
					break
				}
			}
			if cookie == "" { // no cookie session at all → let auth layer decide
				next.ServeHTTP(w, r)
				return
			}
			if r.Header.Get("X-CSRF-Token") != cookie {
				Error(w, r, log, apperr.ErrForbidden.WithDetail("missing or invalid CSRF token"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermission enforces a permission from the matrix (§9.4), deny-by-default.
func RequirePermission(p rbac.Permission, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, ok := auth.FromContext(r.Context())
			if !ok {
				Error(w, r, log, apperr.ErrUnauthorized)
				return
			}
			if !rbac.Can(id.Role, p) {
				Error(w, r, log, apperr.ErrForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
