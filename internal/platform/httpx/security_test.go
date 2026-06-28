package httpx

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testLogger() *slog.Logger { return slog.New(slog.DiscardHandler) }

func TestRateLimiterWindow(t *testing.T) {
	rl := newRateLimiter(2, time.Minute)
	now := time.Now()
	if ok, rem, _ := rl.take("k", now); !ok || rem != 1 {
		t.Fatalf("first take: ok=%v rem=%d", ok, rem)
	}
	if ok, rem, _ := rl.take("k", now); !ok || rem != 0 {
		t.Fatalf("second take: ok=%v rem=%d", ok, rem)
	}
	if ok, _, _ := rl.take("k", now); ok {
		t.Fatal("third take should be denied")
	}
	// A different key is independent.
	if ok, _, _ := rl.take("other", now); !ok {
		t.Fatal("other key should be allowed")
	}
	// After the window elapses, the key resets.
	if ok, _, _ := rl.take("k", now.Add(2*time.Minute)); !ok {
		t.Fatal("should reset after window")
	}
}

func TestRateLimitMiddleware429(t *testing.T) {
	h := RateLimit(1, time.Minute, testLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request = %d, want 200", rec1.Code)
	}
	if rec1.Header().Get("RateLimit-Limit") != "1" {
		t.Fatalf("missing RateLimit-Limit header")
	}

	// Same client (httptest sets an identical default RemoteAddr) → limited.
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request = %d, want 429", rec2.Code)
	}
}

func TestSecurityHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	SecurityHeaders(true)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {})).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Strict-Transport-Security"} {
		if rec.Header().Get(h) == "" {
			t.Errorf("missing security header %s", h)
		}
	}
}
