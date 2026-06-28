package scheduling_test

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
	"github.com/aura/cbs/internal/scheduling"
)

func TestCSVIngestionEndToEnd(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := db.New(ctx, url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)
	svc := scheduling.NewService(store)

	suffix := uuid.NewString()[:8]
	bld, err := store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: "B-" + suffix, Name: "B"})
	require.NoError(t, err)
	roomCode := "RM-" + suffix
	_, err = store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: roomCode, Name: "Room", BuildingID: bld.ID, Capacity: 30,
		RoomType: dbgen.RoomTypeSEMINARROOM, Status: dbgen.RoomStatusACTIVE,
	})
	require.NoError(t, err)
	uploader, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "tt-" + suffix + "@x.edu", PasswordHash: "x", FullName: "TT",
		Role: dbgen.UserRoleTIMETABLEADMIN, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)
	sem, err := store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name: "S-" + suffix, StartDate: pgconv.Date(time.Now().AddDate(0, 0, -10)),
		EndDate: pgconv.Date(time.Now().AddDate(0, 0, 100)), Status: dbgen.SemesterStatusDRAFT,
	})
	require.NoError(t, err)

	csv := fmt.Sprintf(`Course Code,Course Title,Lecturer,Room,Day,Start Time,End Time
CS101,Intro,Dr X,%[1]s,MON,08:00,10:00
CS102,Data,Dr Y,%[1]s,MON,25:00,26:00
CS101,Intro,Dr X,%[1]s,MON,08:00,10:00
CS103,Algo,Dr Z,NOSUCHROOM,TUE,09:00,10:00
CS104,Nets,Dr W,%[1]s,WED,8:00 AM,9:30 AM
`, roomCode)

	rows, err := scheduling.ReadCSV(strings.NewReader(csv))
	require.NoError(t, err)
	require.Len(t, rows, 5)

	imp, err := svc.CreateImport(ctx, sem.ID, uploader.ID, dbgen.ImportMethodCSV, nil)
	require.NoError(t, err)

	result, err := svc.ProcessImport(ctx, imp.ID, sem.ID, rows, scheduling.ModeAppend)
	require.NoError(t, err)

	// Row 1 + row 5 valid (2). Row 2 bad time, row 3 duplicate, row 4 unknown room (3 errors).
	require.EqualValues(t, 5, result.TotalRows)
	require.EqualValues(t, 2, result.ImportedRows)
	require.EqualValues(t, 3, result.ErrorRows)
	require.Equal(t, dbgen.ImportStatusPARTIALLYCOMPLETED, result.Status)

	events, err := store.ListTimetableEvents(ctx, dbgen.ListTimetableEventsParams{SemesterID: &sem.ID})
	require.NoError(t, err)
	require.Len(t, events, 2)
}
