package reporting_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
	"github.com/aura/cbs/internal/reporting"
)

func TestUtilisationReport(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)
	svc := reporting.NewService(store)

	suffix := uuid.NewString()[:8]
	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "RB-" + suffix, Name: "B"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "RR-" + suffix, Name: "Room", BuildingID: bld.ID, Capacity: 40,
		RoomType: dbgen.RoomTypeLECTUREHALL, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)

	// Active semester spanning a known Monday-containing week.
	_, err = store.Pool.Exec(ctx, "UPDATE semesters SET status='ARCHIVED' WHERE status='ACTIVE'")
	require.NoError(t, err)
	// Pick a fixed week: the Monday of the current week and the following Sunday.
	now := time.Now()
	monday := now.AddDate(0, 0, -int((now.Weekday()+6)%7))
	from := time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 7)
	sem, err := store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name: "RS-" + suffix, StartDate: pgconv.Date(from.AddDate(0, 0, -1)),
		EndDate: pgconv.Date(to.AddDate(0, 0, 1)), Status: dbgen.SemesterStatusDRAFT,
	})
	require.NoError(t, err)
	_, err = store.SetSemesterStatus(ctx, dbgen.SetSemesterStatusParams{ID: sem.ID, Status: dbgen.SemesterStatusACTIVE})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = store.Pool.Exec(context.Background(), "UPDATE semesters SET status='ARCHIVED' WHERE id=$1", sem.ID)
	})

	// One Monday lecture, 2 hours. Over a single week → 2 lecture-hours.
	_, err = store.CreateTimetableEvent(ctx, dbgen.CreateTimetableEventParams{
		SemesterID: sem.ID, RoomID: room.ID, CourseCode: "C", CourseTitle: "T", LecturerName: "L",
		Day: dbgen.DayOfWeekMON, StartTime: pgconv.ClockToPgTime(9, 0, 0), EndTime: pgconv.ClockToPgTime(11, 0, 0),
	})
	require.NoError(t, err)

	rep, err := svc.Utilisation(ctx, reporting.Filter{From: from, To: to, BuildingID: &bld.ID})
	require.NoError(t, err)
	require.Len(t, rep.Rooms, 1)
	require.InDelta(t, 2.0, rep.Rooms[0].LectureHours, 0.01, "one 2h Monday lecture over one week = 2 lecture-hours")
	require.EqualValues(t, 0, rep.Rooms[0].BookedHours)
}

func TestBookingsReport(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)
	svc := reporting.NewService(store)

	suffix := uuid.NewString()[:8]
	dept, err := store.CreateDepartment(ctx, dbgen.CreateDepartmentParams{Code: "D-" + suffix, Name: "Dept"})
	require.NoError(t, err)
	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "BB-" + suffix, Name: "B"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "RX-" + suffix, Name: "Room", BuildingID: bld.ID, Capacity: 40,
		RoomType: dbgen.RoomTypeLECTUREHALL, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	deptID := dept.ID
	requester, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "rq-" + suffix + "@x.edu", PasswordHash: "x", FullName: "R",
		Role: dbgen.UserRoleREQUESTER, Status: dbgen.UserStatusACTIVE, DepartmentID: &deptID,
	})
	require.NoError(t, err)

	loc, _ := time.LoadLocation("Africa/Accra")
	now := time.Now().In(loc)
	mk := func(h int) (time.Time, time.Time) {
		d := now.AddDate(0, 0, 1)
		s := time.Date(d.Year(), d.Month(), d.Day(), h, 0, 0, 0, loc)
		return s, s.Add(time.Hour)
	}
	// One approved, one rejected.
	s1, e1 := mk(9)
	b1, err := store.CreateBooking(ctx, dbgen.CreateBookingParams{RoomID: room.ID, RequestedBy: requester.ID, Purpose: "P", AttendeeCount: 5, StartsAt: pgconv.TS(s1), EndsAt: pgconv.TS(e1)})
	require.NoError(t, err)
	_, err = store.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{ID: b1.ID, Status: dbgen.BookingStatusAPPROVED, ReviewedBy: &requester.ID})
	require.NoError(t, err)
	s2, e2 := mk(11)
	b2, err := store.CreateBooking(ctx, dbgen.CreateBookingParams{RoomID: room.ID, RequestedBy: requester.ID, Purpose: "P", AttendeeCount: 5, StartsAt: pgconv.TS(s2), EndsAt: pgconv.TS(e2)})
	require.NoError(t, err)
	_, err = store.SetBookingStatus(ctx, dbgen.SetBookingStatusParams{ID: b2.ID, Status: dbgen.BookingStatusREJECTED, ReviewedBy: &requester.ID})
	require.NoError(t, err)

	rep, err := svc.Bookings(ctx, reporting.Filter{From: now.AddDate(0, 0, -1), To: now.AddDate(0, 0, 2), BuildingID: &bld.ID})
	require.NoError(t, err)
	require.EqualValues(t, 1, rep.ByStatus["APPROVED"])
	require.EqualValues(t, 1, rep.ByStatus["REJECTED"])
	require.EqualValues(t, 2, rep.TotalRequests)
	require.InDelta(t, 50.0, rep.ApprovalRate, 0.01)
	require.EqualValues(t, 2, rep.ByDepartment[dept.Code]) // both requests, same department
}
