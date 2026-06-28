package scheduling_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/scheduling"
)

func newSchedSvc(t *testing.T) (*scheduling.Service, *db.Store) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	store, err := db.New(context.Background(), url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)
	return scheduling.NewService(store), store
}

func TestSemesterLifecycle(t *testing.T) {
	svc, store := newSchedSvc(t)
	ctx := context.Background()
	_, err := store.Pool.Exec(ctx, "UPDATE semesters SET status='ARCHIVED' WHERE status='ACTIVE'")
	require.NoError(t, err)

	now := time.Now()
	in := scheduling.SemesterInput{Name: "Sem " + uuid.NewString()[:6], StartDate: now, EndDate: now.AddDate(0, 4, 0)}
	sem, err := svc.CreateSemester(ctx, in)
	require.NoError(t, err)
	require.Equal(t, "DRAFT", string(sem.Status))

	// Reject end <= start.
	_, err = svc.CreateSemester(ctx, scheduling.SemesterInput{Name: "bad", StartDate: now, EndDate: now.AddDate(0, 0, -1)})
	require.Error(t, err)

	got, err := svc.GetSemester(ctx, sem.ID)
	require.NoError(t, err)
	require.Equal(t, sem.ID, got.ID)

	all, err := svc.ListSemesters(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, all)

	in.Name = "Renamed"
	upd, err := svc.UpdateSemester(ctx, sem.ID, in)
	require.NoError(t, err)
	require.Equal(t, "Renamed", upd.Name)

	active, err := svc.Activate(ctx, sem.ID)
	require.NoError(t, err)
	require.Equal(t, "ACTIVE", string(active.Status))
	t.Cleanup(func() {
		_, _ = store.Pool.Exec(context.Background(), "UPDATE semesters SET status='ARCHIVED' WHERE id=$1", sem.ID)
	})

	// BR2: a second active semester is rejected.
	sem2, err := svc.CreateSemester(ctx, scheduling.SemesterInput{Name: "Sem2", StartDate: now, EndDate: now.AddDate(0, 4, 0)})
	require.NoError(t, err)
	_, err = svc.Activate(ctx, sem2.ID)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "ACTIVE_SEMESTER_EXISTS", ae.Code)

	// Archive the first, then the second can activate.
	_, err = svc.Archive(ctx, sem.ID)
	require.NoError(t, err)
	_, err = svc.Activate(ctx, sem2.ID)
	require.NoError(t, err)
	_, _ = svc.Archive(ctx, sem2.ID)
	require.NoError(t, svc.DeleteSemester(ctx, sem2.ID))
}

func TestEventCRUD(t *testing.T) {
	svc, store := newSchedSvc(t)
	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "SB-" + suffix, Name: "B"})
	require.NoError(t, err)
	room, err := store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: "SR-" + suffix, Name: "R", BuildingID: bld.ID, Capacity: 30,
		RoomType: dbgen.RoomTypeSEMINARROOM, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	sem, err := svc.CreateSemester(ctx, scheduling.SemesterInput{Name: "S " + suffix, StartDate: time.Now(), EndDate: time.Now().AddDate(0, 4, 0)})
	require.NoError(t, err)

	ev, err := svc.CreateEvent(ctx, scheduling.EventInput{
		SemesterID: sem.ID, RoomID: room.ID, CourseCode: "X1", CourseTitle: "T", LecturerName: "L",
		Day: dbgen.DayOfWeekTUE, StartHour: 9, StartMin: 0, EndHour: 11, EndMin: 0,
	})
	require.NoError(t, err)

	// end <= start rejected.
	_, err = svc.CreateEvent(ctx, scheduling.EventInput{SemesterID: sem.ID, RoomID: room.ID, CourseCode: "X2", Day: dbgen.DayOfWeekWED, StartHour: 11, EndHour: 10})
	require.Error(t, err)

	upd, err := svc.UpdateEvent(ctx, ev.ID, scheduling.EventInput{
		SemesterID: sem.ID, RoomID: room.ID, CourseCode: "X1", CourseTitle: "T2", LecturerName: "L",
		Day: dbgen.DayOfWeekTUE, StartHour: 9, StartMin: 0, EndHour: 10, EndMin: 30,
	})
	require.NoError(t, err)
	require.Equal(t, "T2", upd.CourseTitle)

	events, err := svc.ListEvents(ctx, dbgen.ListTimetableEventsParams{SemesterID: &sem.ID})
	require.NoError(t, err)
	require.Len(t, events, 1)

	require.NoError(t, svc.DeleteEvent(ctx, ev.ID))
	events, err = svc.ListEvents(ctx, dbgen.ListTimetableEventsParams{SemesterID: &sem.ID})
	require.NoError(t, err)
	require.Empty(t, events)
}
