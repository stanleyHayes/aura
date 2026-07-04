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
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/config"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// TestEndToEndHTTP drives the full router (middleware → RBAC → handlers → DB)
// over HTTP, the way a client does. Skips without TEST_DATABASE_URL.
func TestEndToEndHTTP(t *testing.T) {
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

	// Seed isolated fixtures directly.
	suffix := uuid.NewString()[:8]
	hash, err := auth.HashPassword("Password123!", auth.Argon2Params{MemoryKiB: 16384, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32})
	require.NoError(t, err)
	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "E2E-" + suffix, Name: "E2E"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "E2ER-" + suffix, Name: "E2E Room", BuildingID: bld.ID, Capacity: 50,
		RoomType: dbgen.RoomTypeLECTUREHALL, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	reqEmail := "e2e-req-" + suffix + "@x.edu"
	offEmail := "e2e-off-" + suffix + "@x.edu"
	_, err = store.CreateUser(ctx, dbgen.CreateUserParams{Email: reqEmail, PasswordHash: hash, FullName: "Req", Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE})
	require.NoError(t, err)
	_, err = store.CreateUser(ctx, dbgen.CreateUserParams{Email: offEmail, PasswordHash: hash, FullName: "Off", Role: dbgen.UserRoleADMIN, Status: dbgen.UserStatusACTIVE})
	require.NoError(t, err)

	c := &apiClient{t: t, base: srv.URL}

	// Unauthenticated access is rejected.
	require.Equal(t, http.StatusUnauthorized, c.status("GET", "/api/v1/rooms", "", nil))

	reqTok := c.login(reqEmail)
	offTok := c.login(offEmail)

	// Requester lists rooms (auth ok) and searches availability.
	require.Equal(t, http.StatusOK, c.status("GET", "/api/v1/rooms", reqTok, nil))
	tmrw := time.Now().In(loc).AddDate(0, 0, 1).Format("2006-01-02")
	require.Equal(t, http.StatusOK, c.status("GET", "/api/v1/availability/search?date="+tmrw+"&start=14:00&end=16:00", reqTok, nil))

	// Requester submits a booking.
	body := map[string]any{
		"room_id": room.ID, "purpose": "E2E", "attendee_count": 10,
		"starts_at": tmrw + "T14:00:00Z", "ends_at": tmrw + "T16:00:00Z",
	}
	var created struct {
		Booking struct {
			ID     uuid.UUID `json:"id"`
			Status string    `json:"status"`
		} `json:"booking"`
	}
	require.Equal(t, http.StatusCreated, c.do("POST", "/api/v1/bookings", reqTok, body, &created))
	require.Equal(t, "PENDING", created.Booking.Status)

	// Requester may NOT approve (RBAC), officer may.
	require.Equal(t, http.StatusForbidden, c.status("POST", "/api/v1/bookings/"+created.Booking.ID.String()+"/approve", reqTok, map[string]any{}))
	var approved struct {
		Status string `json:"status"`
	}
	require.Equal(t, http.StatusOK, c.do("POST", "/api/v1/bookings/"+created.Booking.ID.String()+"/approve", offTok, map[string]any{}, &approved))
	require.Equal(t, "APPROVED", approved.Status)

	// Idempotency (§8.1): same key replays the same booking; same key with a
	// different body is rejected.
	key := uuid.NewString()
	slot := map[string]any{
		"room_id": room.ID, "purpose": "Idem", "attendee_count": 8,
		"starts_at": tmrw + "T09:00:00Z", "ends_at": tmrw + "T10:00:00Z",
	}
	var first, replay struct {
		Booking struct {
			ID uuid.UUID `json:"id"`
		} `json:"booking"`
	}
	require.Equal(t, http.StatusCreated, c.postIdem("/api/v1/bookings", reqTok, key, slot, &first))
	require.Equal(t, http.StatusCreated, c.postIdem("/api/v1/bookings", reqTok, key, slot, &replay))
	require.Equal(t, first.Booking.ID, replay.Booking.ID, "same Idempotency-Key must replay the same booking")
	slot["purpose"] = "Changed"
	require.Equal(t, http.StatusUnprocessableEntity, c.postIdem("/api/v1/bookings", reqTok, key, slot, nil))

	// Security + rate-limit headers are present on responses.
	resp := c.raw("GET", "/healthz", "", nil)
	require.NotEmpty(t, resp.Header.Get("X-Content-Type-Options"))
	require.NotEmpty(t, resp.Header.Get("RateLimit-Limit"))
	_ = resp.Body.Close()
}

func (c *apiClient) postIdem(path, token, key string, body, out any) int {
	b, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", c.base+path, bytes.NewReader(b))
	require.NoError(c.t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Idempotency-Key", key)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	defer func() { _ = resp.Body.Close() }()
	if out != nil {
		data, _ := io.ReadAll(resp.Body)
		require.NoError(c.t, json.Unmarshal(data, out), "body: %s", string(data))
	}
	return resp.StatusCode
}

type apiClient struct {
	t    *testing.T
	base string
}

func (c *apiClient) raw(method, path, token string, body any) *http.Response {
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+path, r)
	require.NoError(c.t, err)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	return resp
}

func (c *apiClient) status(method, path, token string, body any) int {
	resp := c.raw(method, path, token, body)
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode
}

func (c *apiClient) do(method, path, token string, body, out any) int {
	resp := c.raw(method, path, token, body)
	defer func() { _ = resp.Body.Close() }()
	if out != nil {
		data, _ := io.ReadAll(resp.Body)
		require.NoError(c.t, json.Unmarshal(data, out), "body: %s", string(data))
	}
	return resp.StatusCode
}

func (c *apiClient) login(email string) string {
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	code := c.do("POST", "/api/v1/auth/login", "", map[string]any{"email": email, "password": "Password123!"}, &tok)
	require.Equal(c.t, http.StatusOK, code, "login %s", email)
	require.NotEmpty(c.t, tok.AccessToken)
	return tok.AccessToken
}
