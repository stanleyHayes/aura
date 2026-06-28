package availability_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/availability"
	"github.com/aura/cbs/internal/catalogue"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

func newEngine(t *testing.T) (*availability.Engine, *db.Store, *time.Location, uuid.UUID, uuid.UUID, uuid.UUID) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	loc, _ := time.LoadLocation("Africa/Accra")
	store, err := db.New(context.Background(), url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)

	ctx := context.Background()
	suffix := uuid.NewString()[:8]
	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "AB-" + suffix, Name: "B"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "AR-" + suffix, Name: "R", BuildingID: bld.ID, Capacity: 40,
		RoomType: dbgen.RoomTypeLECTUREHALL, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	user, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "av-" + suffix + "@x.edu", PasswordHash: "x", FullName: "U",
		Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)
	eng := availability.NewEngine(store, catalogue.NewService(store), loc)
	return eng, store, loc, room.ID, user.ID, bld.ID
}

func TestEngineSearchAndCalendar(t *testing.T) {
	eng, store, loc, roomID, userID, buildingID := newEngine(t)
	ctx := context.Background()

	// Approve a booking tomorrow 10:00–12:00 (institution-local).
	d := time.Now().In(loc).AddDate(0, 0, 1)
	start := time.Date(d.Year(), d.Month(), d.Day(), 10, 0, 0, 0, loc)
	end := time.Date(d.Year(), d.Month(), d.Day(), 12, 0, 0, 0, loc)
	b, err := store.CreateBooking(ctx, dbgen.CreateBookingParams{
		RoomID: roomID, RequestedBy: userID, Purpose: "P", AttendeeCount: 5,
		StartsAt: pgconv.TS(start), EndsAt: pgconv.TS(end),
	})
	require.NoError(t, err)
	_, err = store.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{ID: b.ID, Status: dbgen.BookingStatusAPPROVED, ReviewedBy: &userID})
	require.NoError(t, err)

	date := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc)

	// Scope to this room's building so the candidate page isn't crowded out by
	// rooms created by other tests.
	scope := catalogue.RoomFilter{BuildingID: &buildingID}

	// Search 10:00–12:00 → the room is excluded (booked).
	booked, err := eng.Search(ctx, availability.SearchQuery{Date: date, StartMin: 600, EndMin: 720, Filter: scope})
	require.NoError(t, err)
	require.False(t, containsRoom(booked, roomID), "booked room must be excluded during its slot")

	// Search 12:00–13:00 (adjacent, free) → the room is present.
	free, err := eng.Search(ctx, availability.SearchQuery{Date: date, StartMin: 720, EndMin: 780, Filter: scope})
	require.NoError(t, err)
	require.True(t, containsRoom(free, roomID), "room must be free immediately after its booking")

	// Calendar day view → contains a BOOKING block (APPROVED) and AVAILABLE gaps.
	blocks, err := eng.Calendar(ctx, availability.CalendarQuery{View: "day", Date: date, RoomID: &roomID})
	require.NoError(t, err)
	var sawBooking, sawAvailable bool
	for _, bl := range blocks {
		if bl.Source == "BOOKING" && bl.Status == "APPROVED" {
			sawBooking = true
		}
		if bl.Source == "AVAILABLE" {
			sawAvailable = true
		}
	}
	require.True(t, sawBooking, "calendar must show the approved booking")
	require.True(t, sawAvailable, "calendar must show available gaps")
}

func containsRoom(results []availability.Result, id uuid.UUID) bool {
	for _, r := range results {
		if r.Room.ID == id {
			return true
		}
	}
	return false
}
