package httpx

import (
	"net/http"
	"time"
)

// Cookie names. The spec (§9.2) mandates __Host- prefixed cookies in production
// (which require Secure + Path=/ + no Domain). Over plain-HTTP local dev the
// browser rejects __Host- cookies, so we fall back to unprefixed names there.
const (
	prodAccessCookie  = "__Host-access"
	prodRefreshCookie = "__Host-refresh"
	prodCSRFCookie    = "__Host-csrf"
	devAccessCookie   = "cbs_access"
	devRefreshCookie  = "cbs_refresh"
	devCSRFCookie     = "cbs_csrf"
)

func accessCookieName(secure bool) string {
	if secure {
		return prodAccessCookie
	}
	return devAccessCookie
}
func refreshCookieName(secure bool) string {
	if secure {
		return prodRefreshCookie
	}
	return devRefreshCookie
}
func csrfCookieName(secure bool) string {
	if secure {
		return prodCSRFCookie
	}
	return devCSRFCookie
}

func base(secure bool) http.Cookie {
	return http.Cookie{Path: "/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode}
}

// SetAuthCookies sets the access, refresh and (non-HttpOnly) CSRF cookies (§9.2).
func SetAuthCookies(w http.ResponseWriter, access, refresh, csrf string, accessTTL, refreshTTL time.Duration, secure bool) {
	ac := base(secure)
	ac.Name, ac.Value, ac.Expires = accessCookieName(secure), access, time.Now().Add(accessTTL)
	http.SetCookie(w, &ac)

	rc := base(secure)
	rc.Name, rc.Value, rc.Expires = refreshCookieName(secure), refresh, time.Now().Add(refreshTTL)
	http.SetCookie(w, &rc)

	cc := base(secure)
	cc.HttpOnly = false // readable by JS for the double-submit header
	cc.Name, cc.Value, cc.Expires = csrfCookieName(secure), csrf, time.Now().Add(refreshTTL)
	http.SetCookie(w, &cc)
}

// ClearAuthCookies expires the auth cookies on logout.
func ClearAuthCookies(w http.ResponseWriter, secure bool) {
	for _, name := range []string{accessCookieName(secure), refreshCookieName(secure), csrfCookieName(secure)} {
		c := base(secure)
		c.Name, c.Value, c.MaxAge, c.Expires = name, "", -1, time.Unix(0, 0)
		http.SetCookie(w, &c)
	}
}

// RefreshCookieValue reads the refresh token from either cookie name.
func RefreshCookieValue(r *http.Request) string {
	for _, name := range []string{prodRefreshCookie, devRefreshCookie} {
		if c, err := r.Cookie(name); err == nil && c.Value != "" {
			return c.Value
		}
	}
	return ""
}
