package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
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

func testConfig(url string) config.Config {
	return config.Config{
		AppEnv: "test", InstitutionTZ: "Africa/Accra", DatabaseURL: url,
		JWTSigningKey: "test-signing-key-long-enough-1234", JWTKeyID: "k1",
		AccessTokenTTL: 15 * time.Minute, RefreshTokenTTL: time.Hour,
		Argon2MemoryKiB: 16384, Argon2Iterations: 1, Argon2Parallelism: 1,
		MFAEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		LoginMaxAttempts: 5, LoginLockWindow: 15 * time.Minute,
		RateLimitDefaultPerMin: 100000, RateLimitAuthPerMin: 100000,
		CORSAllowedOrigins: []string{"http://localhost:3000"},
	}
}

// mkUser inserts a user with a known password and returns the email.
func mkUser(t *testing.T, store *db.Store, role dbgen.UserRole) string {
	t.Helper()
	hash, err := auth.HashPassword("Password123!", auth.Argon2Params{MemoryKiB: 16384, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32})
	require.NoError(t, err)
	email := "surf-" + uuid.NewString()[:8] + "@x.edu"
	_, err = store.CreateUser(context.Background(), dbgen.CreateUserParams{
		Email: email, PasswordHash: hash, FullName: "Surf", Role: role, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)
	return email
}

// TestAPIFullSurface walks the whole HTTP surface across all roles, asserting
// routing, RBAC and validation end-to-end.
func TestAPIFullSurface(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)
	loc, _ := time.LoadLocation("Africa/Accra")
	handler, err := buildRouter(testConfig(url), store, loc, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	c := &apiClient{t: t, base: srv.URL}

	admin := c.login(mkUser(t, store, dbgen.UserRoleSYSTEMADMIN))
	ttadmin := c.login(mkUser(t, store, dbgen.UserRoleTIMETABLEADMIN))
	officer := c.login(mkUser(t, store, dbgen.UserRoleBOOKINGOFFICER))
	requester := c.login(mkUser(t, store, dbgen.UserRoleREQUESTER))

	// ── Catalogue (admin) ─────────────────────────────────────────────────────
	var bldg struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/buildings", admin, map[string]any{"code": "S-" + uniq(), "name": "Surf Hall"}, &bldg))
	require.Equal(t, 200, c.status("GET", "/api/v1/buildings", requester, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/buildings/"+bldg.ID.String(), requester, nil))
	require.Equal(t, 403, c.status("POST", "/api/v1/buildings", requester, map[string]any{"code": "X", "name": "Y"})) // RBAC

	var equip struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/equipment", admin, map[string]any{"code": "PROJ-" + uniq(), "name": "Projector"}, &equip))
	require.Equal(t, 200, c.status("GET", "/api/v1/equipment/"+equip.ID.String(), requester, nil))

	roomCode := "SRM-" + uniq()
	var room struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/rooms", admin, map[string]any{
		"room_code": roomCode, "name": "Surf Room", "building_id": bldg.ID, "capacity": 60, "room_type": "LECTURE_HALL",
	}, &room))
	require.Equal(t, 200, c.status("GET", "/api/v1/rooms/"+room.ID.String(), requester, nil))
	require.Equal(t, 200, c.status("PATCH", "/api/v1/rooms/"+room.ID.String(), admin, map[string]any{
		"room_code": roomCode, "name": "Surf Room 2", "building_id": bldg.ID, "capacity": 80, "room_type": "LECTURE_HALL", "status": "ACTIVE",
	}))
	require.Equal(t, 200, c.status("PUT", "/api/v1/rooms/"+room.ID.String()+"/equipment", admin, map[string]any{
		"equipment": []map[string]any{{"equipment_id": equip.ID, "quantity": 2}},
	}))

	// Invalid room type → validation error.
	require.Equal(t, 400, c.status("POST", "/api/v1/rooms", admin, map[string]any{
		"room_code": "BAD-" + uniq(), "name": "x", "building_id": bldg.ID, "capacity": 10, "room_type": "NOPE",
	}))

	// ── Users & departments (admin) ───────────────────────────────────────────
	var dept struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/departments", admin, map[string]any{"code": "DP-" + uniq(), "name": "Dept"}, &dept))
	require.Equal(t, 200, c.status("GET", "/api/v1/users", admin, nil))
	require.Equal(t, 403, c.status("GET", "/api/v1/users", requester, nil)) // RBAC
	var newUser struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/users", admin, map[string]any{
		"email": "made-" + uniq() + "@x.edu", "password": "Password123!", "full_name": "Made", "role": "REQUESTER",
	}, &newUser))
	require.Equal(t, 200, c.status("PATCH", "/api/v1/users/"+newUser.ID.String()+"/role", admin, map[string]any{"role": "BOOKING_OFFICER"}))
	require.Equal(t, 200, c.status("POST", "/api/v1/users/"+newUser.ID.String()+"/suspend", admin, nil))
	require.Equal(t, 200, c.status("POST", "/api/v1/users/"+newUser.ID.String()+"/reactivate", admin, nil))

	// ── Semesters + timetable (admin activates; timetable-admin imports) ───────
	var sem struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/semesters", admin, map[string]any{
		"name": "Surf Sem " + uniq(), "start_date": "2026-01-13", "end_date": "2026-05-15",
	}, &sem))
	// Clear any pre-existing active semester so activation succeeds deterministically.
	_, _ = store.Pool.Exec(ctx, "UPDATE semesters SET status='ARCHIVED' WHERE status='ACTIVE'")
	require.Equal(t, 200, c.status("POST", "/api/v1/semesters/"+sem.ID.String()+"/activate", admin, nil))
	t.Cleanup(func() {
		_, _ = store.Pool.Exec(context.Background(), "UPDATE semesters SET status='ARCHIVED' WHERE id=$1", sem.ID)
	})

	// Manual timetable event (timetable-admin); requester is forbidden.
	require.Equal(t, 403, c.status("POST", "/api/v1/timetable/events", requester, map[string]any{}))
	var ev struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/timetable/events", ttadmin, map[string]any{
		"semester_id": sem.ID, "room_id": room.ID, "course_code": "CS1", "course_title": "Intro",
		"lecturer_name": "Dr X", "day": "SAT", "start_time": "08:00", "end_time": "10:00",
	}, &ev))
	require.Equal(t, 200, c.status("GET", "/api/v1/timetable/events?semester_id="+sem.ID.String(), ttadmin, nil))
	require.Equal(t, 204, c.status("DELETE", "/api/v1/timetable/events/"+ev.ID.String(), ttadmin, nil))

	// CSV import via multipart.
	csv := "Course Code,Course Title,Lecturer,Room,Day,Start Time,End Time\nCS2,Data,Dr Y," + roomCode + ",WED,10:00,12:00\n"
	var imp struct {
		ID           uuid.UUID `json:"id"`
		ImportedRows int       `json:"imported_rows"`
	}
	require.Equal(t, 202, c.postMultipart("/api/v1/semesters/"+sem.ID.String()+"/timetable/import", ttadmin,
		"file", "tt.csv", []byte(csv), map[string]string{"mode": "append"}, &imp))
	require.Equal(t, 1, imp.ImportedRows)
	require.Equal(t, 200, c.status("GET", "/api/v1/timetable/imports/"+imp.ID.String(), ttadmin, nil))

	// ── Maintenance (admin) ───────────────────────────────────────────────────
	tmrw := time.Now().In(loc).AddDate(0, 0, 1).Format("2006-01-02")
	var mw struct {
		ID uuid.UUID `json:"id"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/maintenance-windows", admin, map[string]any{
		"room_id": room.ID, "starts_at": tmrw + "T06:00:00Z", "ends_at": tmrw + "T07:00:00Z", "reason": "test",
	}, &mw))
	require.Equal(t, 200, c.status("GET", "/api/v1/maintenance-windows?room_id="+room.ID.String(), admin, nil))
	require.Equal(t, 204, c.status("DELETE", "/api/v1/maintenance-windows/"+mw.ID.String(), admin, nil))

	// ── Availability, calendar, bookings ──────────────────────────────────────
	require.Equal(t, 200, c.status("GET", "/api/v1/availability/search?date="+tmrw+"&start=14:00&end=16:00&building_id="+bldg.ID.String(), requester, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/calendar?view=day&date="+tmrw+"&room_id="+room.ID.String(), officer, nil))
	require.Equal(t, 400, c.status("GET", "/api/v1/calendar?view=day&date="+tmrw, officer, nil)) // needs room/building

	var bk struct {
		Booking struct {
			ID uuid.UUID `json:"id"`
		} `json:"booking"`
	}
	require.Equal(t, 201, c.do("POST", "/api/v1/bookings", requester, map[string]any{
		"room_id": room.ID, "purpose": "Study", "attendee_count": 12, "starts_at": tmrw + "T14:00:00Z", "ends_at": tmrw + "T16:00:00Z",
	}, &bk))
	// Past booking → 422.
	require.Equal(t, 422, c.status("POST", "/api/v1/bookings", requester, map[string]any{
		"room_id": room.ID, "purpose": "Past", "attendee_count": 5, "starts_at": "2020-01-01T09:00:00Z", "ends_at": "2020-01-01T10:00:00Z",
	}))
	// Over capacity → 422.
	require.Equal(t, 422, c.status("POST", "/api/v1/bookings", requester, map[string]any{
		"room_id": room.ID, "purpose": "Big", "attendee_count": 9999, "starts_at": tmrw + "T17:00:00Z", "ends_at": tmrw + "T18:00:00Z",
	}))

	require.Equal(t, 200, c.status("GET", "/api/v1/bookings?scope=mine", requester, nil))
	require.Equal(t, 403, c.status("GET", "/api/v1/bookings?scope=all", requester, nil)) // RBAC
	require.Equal(t, 200, c.status("GET", "/api/v1/bookings?scope=pending", officer, nil))

	// Reject (officer) requires a note.
	require.Equal(t, 400, c.status("POST", "/api/v1/bookings/"+bk.Booking.ID.String()+"/reject", officer, map[string]any{}))
	require.Equal(t, 200, c.status("POST", "/api/v1/bookings/"+bk.Booking.ID.String()+"/reject", officer, map[string]any{"note": "no"}))

	// ── Notifications & devices (requester) ───────────────────────────────────
	require.Equal(t, 200, c.status("GET", "/api/v1/notifications", requester, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/notifications/unread-count", requester, nil))
	require.Equal(t, 204, c.status("POST", "/api/v1/notifications/read-all", requester, nil))
	require.Equal(t, 204, c.status("POST", "/api/v1/devices", requester, map[string]any{"expo_token": "ExponentPushToken[" + uniq() + "]"}))

	// ── Reports (officer; requester forbidden) ────────────────────────────────
	require.Equal(t, 200, c.status("GET", "/api/v1/reports/utilisation?from="+tmrw+"&to="+tmrw, officer, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/reports/bookings", officer, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/reports/conflicts", officer, nil))
	require.Equal(t, 403, c.status("GET", "/api/v1/reports/utilisation", requester, nil)) // RBAC

	// ── Audit log (admin only) ────────────────────────────────────────────────
	require.Equal(t, 200, c.status("GET", "/api/v1/audit-logs?limit=25&entity_type=booking", admin, nil))
	require.Equal(t, 200, c.status("GET", "/api/v1/audit-logs?action=LOGIN", admin, nil))
	require.Equal(t, 403, c.status("GET", "/api/v1/audit-logs", requester, nil)) // RBAC
}

func (c *apiClient) postMultipart(path, token, field, filename string, content []byte, fields map[string]string, out any) int {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile(field, filename)
	require.NoError(c.t, err)
	_, _ = fw.Write(content)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	_ = w.Close()
	req, err := http.NewRequest("POST", c.base+path, &buf)
	require.NoError(c.t, err)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	defer func() { _ = resp.Body.Close() }()
	if out != nil {
		data, _ := io.ReadAll(resp.Body)
		require.NoError(c.t, json.Unmarshal(data, out), "body: %s", string(data))
	}
	return resp.StatusCode
}

func uniq() string { return uuid.NewString()[:8] }
