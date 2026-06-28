package bookings_test

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// These are integration tests against a real PostgreSQL 18 (exclusion
// constraints + the validation trigger are exercised). Set TEST_DATABASE_URL to
// a migrated database to run them; otherwise they skip.

const institutionTZ = "Africa/Accra"

func testStore(t *testing.T) (*db.Store, *time.Location) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB integration test")
	}
	loc, err := time.LoadLocation(institutionTZ)
	require.NoError(t, err)
	store, err := db.New(context.Background(), url, institutionTZ)
	require.NoError(t, err)
	t.Cleanup(store.Close)
	return store, loc
}

// fixture creates an isolated building, room and two users with unique codes so
// repeated runs never collide.
type fixture struct {
	store     *db.Store
	loc       *time.Location
	roomID    uuid.UUID
	requester uuid.UUID
	officer   uuid.UUID
}

func newFixture(t *testing.T, capacity int) fixture {
	store, loc := testStore(t)
	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	b, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "B-" + suffix, Name: "Test Building"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "R-" + suffix, Name: "Test Room", BuildingID: b.ID,
		Capacity: int32(capacity), RoomType: dbgen.RoomTypeLECTUREHALL, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	req, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "req-" + suffix + "@x.edu", PasswordHash: "x", FullName: "Requester",
		Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)
	off, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "off-" + suffix + "@x.edu", PasswordHash: "x", FullName: "Officer",
		Role: dbgen.UserRoleBOOKINGOFFICER, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)

	return fixture{store: store, loc: loc, roomID: room.ID, requester: req.ID, officer: off.ID}
}

// tomorrowWindow returns a future single-day window in institution-local time.
func (f fixture) tomorrowWindow(startHour, endHour int) (time.Time, time.Time) {
	now := time.Now().In(f.loc)
	d := now.AddDate(0, 0, 1)
	start := time.Date(d.Year(), d.Month(), d.Day(), startHour, 0, 0, 0, f.loc)
	end := time.Date(d.Year(), d.Month(), d.Day(), endHour, 0, 0, 0, f.loc)
	return start, end
}

// TestConcurrentApprovalSingleWinner is the mandatory concurrency test (§16):
// N officers approve N competing PENDING bookings for one slot; exactly one
// succeeds, the rest get 409 SLOT_NO_LONGER_AVAILABLE, and the database ends
// with exactly one APPROVED booking.
func TestConcurrentApprovalSingleWinner(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()
	start, end := f.tomorrowWindow(10, 12)

	const n = 12
	ids := make([]uuid.UUID, n)
	for i := 0; i < n; i++ {
		res, err := svc.Create(ctx, bookings.CreateInput{
			RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Competing request",
			AttendeeCount: 10, StartsAt: start, EndsAt: end,
		})
		require.NoError(t, err, "all PENDING submissions for the same slot must succeed (BR5)")
		ids[i] = res.Booking.ID
	}

	results := make([]error, n)
	var wg sync.WaitGroup
	barrier := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-barrier // release all goroutines at once to maximise contention
			_, results[i] = svc.Approve(ctx, ids[i], f.officer, nil)
		}(i)
	}
	close(barrier)
	wg.Wait()

	success, conflicts := 0, 0
	for _, err := range results {
		if err == nil {
			success++
			continue
		}
		ae, ok := apperr.As(err)
		require.True(t, ok, "unexpected error type: %v", err)
		require.Equal(t, "SLOT_NO_LONGER_AVAILABLE", ae.Code, "losers must get SLOT_NO_LONGER_AVAILABLE")
		conflicts++
	}
	require.Equal(t, 1, success, "exactly one approval must succeed")
	require.Equal(t, n-1, conflicts, "every other approval must lose")

	// The database is the source of truth: exactly one APPROVED booking.
	var approved int
	err := f.store.Pool.QueryRow(ctx,
		"SELECT count(*) FROM bookings WHERE room_id=$1 AND status='APPROVED'", f.roomID).Scan(&approved)
	require.NoError(t, err)
	require.Equal(t, 1, approved, "database must contain exactly one approved booking")
}

// TestSubmitRejectsLectureConflict verifies BR1: a request overlapping an
// active-semester lecture is rejected at submission.
func TestSubmitRejectsLectureConflict(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()

	// Only one ACTIVE semester may exist (BR2); clear any leftover from a prior
	// run so this test can activate its own, and archive it again on cleanup.
	_, err := f.store.Pool.Exec(ctx, "UPDATE semesters SET status='ARCHIVED' WHERE status='ACTIVE'")
	require.NoError(t, err)

	// Active semester covering tomorrow + a lecture on the room for the same
	// weekday as our target window.
	start, end := f.tomorrowWindow(10, 12)
	weekday := weekdayCode(start)

	sem, err := f.store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name:      "Sem " + uuid.NewString()[:6],
		StartDate: pgconv.Date(start.AddDate(0, 0, -30)), EndDate: pgconv.Date(start.AddDate(0, 0, 30)),
		Status: dbgen.SemesterStatusDRAFT,
	})
	require.NoError(t, err)
	_, err = f.store.SetSemesterStatus(ctx, dbgen.SetSemesterStatusParams{ID: sem.ID, Status: dbgen.SemesterStatusACTIVE})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = f.store.Pool.Exec(context.Background(), "UPDATE semesters SET status='ARCHIVED' WHERE id=$1", sem.ID)
	})

	_, err = f.store.CreateTimetableEvent(ctx, dbgen.CreateTimetableEventParams{
		SemesterID: sem.ID, RoomID: f.roomID, CourseCode: "CS101", CourseTitle: "Intro",
		LecturerName: "Dr X", Day: weekday,
		StartTime: pgconv.ClockToPgTime(9, 0, 0), EndTime: pgconv.ClockToPgTime(11, 0, 0), // overlaps 10–12
	})
	require.NoError(t, err)

	_, err = svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Clashes with lecture",
		AttendeeCount: 10, StartsAt: start, EndsAt: end,
	})
	ae, ok := apperr.As(err)
	require.True(t, ok, "expected an apperr, got %v", err)
	require.Equal(t, "CONFLICTS_WITH_LECTURE", ae.Code)
}

// TestSubmitRejectsCapacityAndPast verifies BR3 and BR4 via the trigger.
func TestSubmitRejectsCapacityAndPast(t *testing.T) {
	f := newFixture(t, 20)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()

	start, end := f.tomorrowWindow(14, 16)
	_, err := svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Too many",
		AttendeeCount: 999, StartsAt: start, EndsAt: end,
	})
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "ATTENDEES_EXCEED_CAPACITY", ae.Code)

	past := time.Now().In(f.loc).Add(-2 * time.Hour)
	pastEnd := past.Add(time.Hour)
	_, err = svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "In the past",
		AttendeeCount: 5, StartsAt: past, EndsAt: pastEnd,
	})
	ae, ok = apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "BOOKING_IN_PAST", ae.Code)
}

func weekdayCode(t time.Time) dbgen.DayOfWeek {
	return [...]dbgen.DayOfWeek{
		dbgen.DayOfWeekSUN, dbgen.DayOfWeekMON, dbgen.DayOfWeekTUE, dbgen.DayOfWeekWED,
		dbgen.DayOfWeekTHU, dbgen.DayOfWeekFRI, dbgen.DayOfWeekSAT,
	}[int(t.Weekday())]
}
