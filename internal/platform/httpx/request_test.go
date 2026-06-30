package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPTrustedProxy(t *testing.T) {
	mk := func(xff string) *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = "10.0.0.1:5555" // the nearest proxy / direct peer
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}

	// Restore the global after the test so other tests are unaffected.
	t.Cleanup(func() { SetTrustedProxyCount(0) })

	cases := []struct {
		name  string
		count int
		xff   string
		want  string
	}{
		{"untrusted ignores XFF, uses RemoteAddr", 0, "1.2.3.4, 5.6.7.8", "10.0.0.1"},
		{"untrusted with spoofed single XFF still uses RemoteAddr", 0, "9.9.9.9", "10.0.0.1"},
		{"one trusted hop takes rightmost entry", 1, "1.2.3.4, 203.0.113.7", "203.0.113.7"},
		{"two trusted hops steps two from right", 2, "198.51.100.5, 1.2.3.4, 203.0.113.7", "1.2.3.4"},
		{"trusted but XFF too short falls back to RemoteAddr", 2, "203.0.113.7", "10.0.0.1"},
		{"trusted but no XFF falls back to RemoteAddr", 1, "", "10.0.0.1"},
		{"spoof attempt: attacker prepends fake, one trusted hop ignores it", 1, "evil-spoof, 203.0.113.7", "203.0.113.7"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			SetTrustedProxyCount(tc.count)
			got := ClientIP(mk(tc.xff))
			if got == nil {
				t.Fatalf("ClientIP returned nil, want %q", tc.want)
			}
			if *got != tc.want {
				t.Fatalf("ClientIP = %q, want %q", *got, tc.want)
			}
		})
	}
}
