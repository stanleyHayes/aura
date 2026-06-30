package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/config"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// TestAuthModesCookieVsBearer verifies PART C: the default (web) login uses
// HttpOnly cookies and omits the refresh token from the body, while a request
// with X-Auth-Mode: bearer returns the refresh token in the body and sets NO
// cookies. The two modes must not interfere with each other.
func TestAuthModesCookieVsBearer(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)

	cfg := config.Config{
		AppEnv: "test", InstitutionTZ: "Africa/Accra", DatabaseURL: url,
		JWTSigningKey: "test-signing-key-long-enough-1234", JWTKeyID: "k1",
		AccessTokenTTL: 15 * time.Minute, RefreshTokenTTL: time.Hour,
		Argon2MemoryKiB: 16384, Argon2Iterations: 1, Argon2Parallelism: 1,
		MFAEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		LoginMaxAttempts: 5, LoginLockWindow: 15 * time.Minute,
		RateLimitDefaultPerMin: 100000, RateLimitAuthPerMin: 100000,
		CORSAllowedOrigins: []string{"http://localhost:3000"},
	}
	loc, _ := time.LoadLocation("Africa/Accra")
	handler, err := buildRouter(cfg, store, loc, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	suffix := uuid.NewString()[:8]
	hash, err := auth.HashPassword("Password123!", auth.Argon2Params{MemoryKiB: 16384, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32})
	require.NoError(t, err)
	email := "authmode-" + suffix + "@x.edu"
	_, err = store.CreateUser(ctx, dbgen.CreateUserParams{Email: email, PasswordHash: hash, FullName: "Auth", Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE})
	require.NoError(t, err)

	loginBody := map[string]any{"email": email, "password": "Password123!"}

	doLogin := func(bearer bool) (*http.Response, []byte) {
		b, _ := json.Marshal(loginBody)
		req, err := http.NewRequest("POST", srv.URL+"/api/v1/auth/login", bytes.NewReader(b))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		if bearer {
			req.Header.Set("X-Auth-Mode", "bearer")
		}
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		data, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return resp, data
	}

	type tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}

	// ── Cookie mode (default web flow) ──────────────────────────────────────────
	cookieResp, cookieData := doLogin(false)
	require.Equal(t, http.StatusOK, cookieResp.StatusCode)
	var ct tokenResp
	require.NoError(t, json.Unmarshal(cookieData, &ct))
	require.NotEmpty(t, ct.AccessToken, "cookie mode still returns the access token")
	require.Empty(t, ct.RefreshToken, "cookie mode must NOT leak the refresh token in the body")

	setCookies := cookieResp.Header.Values("Set-Cookie")
	require.NotEmpty(t, setCookies, "cookie mode must set auth cookies")
	joined := strings.Join(setCookies, "\n")
	require.Contains(t, joined, "refresh", "cookie mode must set a refresh cookie")

	// ── Bearer mode (mobile flow) ───────────────────────────────────────────────
	bearerResp, bearerData := doLogin(true)
	require.Equal(t, http.StatusOK, bearerResp.StatusCode)
	var bt tokenResp
	require.NoError(t, json.Unmarshal(bearerData, &bt))
	require.NotEmpty(t, bt.AccessToken, "bearer mode returns the access token")
	require.NotEmpty(t, bt.RefreshToken, "bearer mode must return the refresh token in the body")
	require.Empty(t, bearerResp.Header.Values("Set-Cookie"), "bearer mode must NOT set any cookies")

	// The refresh token from bearer mode works against /auth/refresh (body) and
	// likewise honours bearer mode (body token, no cookies).
	rb, _ := json.Marshal(map[string]any{"refresh_token": bt.RefreshToken})
	rreq, err := http.NewRequest("POST", srv.URL+"/api/v1/auth/refresh", bytes.NewReader(rb))
	require.NoError(t, err)
	rreq.Header.Set("Content-Type", "application/json")
	rreq.Header.Set("X-Auth-Mode", "bearer")
	rresp, err := http.DefaultClient.Do(rreq)
	require.NoError(t, err)
	rdata, _ := io.ReadAll(rresp.Body)
	_ = rresp.Body.Close()
	require.Equal(t, http.StatusOK, rresp.StatusCode, "refresh body: %s", string(rdata))
	var rt tokenResp
	require.NoError(t, json.Unmarshal(rdata, &rt))
	require.NotEmpty(t, rt.RefreshToken, "bearer refresh rotates and returns a new refresh token in the body")
	require.Empty(t, rresp.Header.Values("Set-Cookie"), "bearer refresh must NOT set cookies")
}
