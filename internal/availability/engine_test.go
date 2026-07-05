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

	// Search now returns every matching room with its labelled occupancy and the
	// free gaps between (the requested window is a client-side highlight only).
	res, err := eng.Search(ctx, availability.SearchQuery{Date: date, StartMin: 600, EndMin: 720, Filter: scope})
	require.NoError(t, err)
	r := findRoom(res, roomID)
	require.NotNil(t, r, "matching room must be present")

	// The approved booking shows as a labelled BUSY block over 10:00–12:00.
	var sawBusyBooking bool
	for _, bb := range r.Busy {
		if bb.Source == "BOOKING" && bb.Start == 600 && bb.End == 720 {
			sawBusyBooking = true
		}
	}
	require.True(t, sawBusyBooking, "approved booking must appear as a busy block")

	// There is free time after the booking.
	var freeAfter bool
	for _, iv := range r.FreeIntervals {
		if iv.Start >= 720 {
			freeAfter = true
		}
	}
	require.True(t, freeAfter, "there must be free time after the booking")

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

func findRoom(results []availability.Result, id uuid.UUID) *availability.Result {
	for i := range results {
		if results[i].Room.ID == id {
			return &results[i]
		}
	}
	return nil
}
