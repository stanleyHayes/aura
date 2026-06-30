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

	result, err := svc.ProcessImport(ctx, imp.ID, sem.ID, rows, scheduling.ModeAppend, false)
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

// TestRealExportProvisioningEndToEnd drives the real Ashesi export header shape
// with createMissing=true: rooms (and their buildings) named only by Location
// are provisioned, two rows sharing a location reuse the same room, and the
// optional Section/Program/Department columns land on the events.
func TestRealExportProvisioningEndToEnd(t *testing.T) {
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
	uploader, err := store.CreateUser(ctx, dbgen.CreateUserParams{
		Email: "tt2-" + suffix + "@x.edu", PasswordHash: "x", FullName: "TT2",
		Role: dbgen.UserRoleTIMETABLEADMIN, Status: dbgen.UserStatusACTIVE,
	})
	require.NoError(t, err)
	sem, err := store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name: "S2-" + suffix, StartDate: pgconv.Date(time.Now().AddDate(0, 0, -10)),
		EndDate: pgconv.Date(time.Now().AddDate(0, 0, 100)), Status: dbgen.SemesterStatusDRAFT,
	})
	require.NoError(t, err)

	// Unique location names per run so the assertions are deterministic. Two rows
	// share the first location to prove the room is created once and reused.
	locA := "Nutor Hall " + suffix
	locB := "Norton-Motulsky " + suffix
	csv := fmt.Sprintf(`Course Code,Course Name,Staff Name,Location,Day,From Time,To Time,Section,Program,Department,Number of Enrollments
BUSA220,Introduction to Finance,Nana Kwasi Karikari,%[1]s,Monday,08:00,09:30,Section A,BSc-BA,BA,51
CS201,Data Structures,Dr Y,%[1]s,Monday,10:00,11:30,Section B,BSc-CS,CS,40
ECON101,Microeconomics,Dr Z,%[2]s,Tuesday,09:00,10:30,Section A,BSc-Econ,ECON,
`, locA, locB)

	rows, err := scheduling.ReadCSV(strings.NewReader(csv))
	require.NoError(t, err)
	require.Len(t, rows, 3)

	imp, err := svc.CreateImport(ctx, sem.ID, uploader.ID, dbgen.ImportMethodCSV, nil)
	require.NoError(t, err)

	result, err := svc.ProcessImport(ctx, imp.ID, sem.ID, rows, scheduling.ModeAppend, true)
	require.NoError(t, err)
	require.EqualValues(t, 3, result.TotalRows)
	require.EqualValues(t, 3, result.ImportedRows)
	require.EqualValues(t, 0, result.ErrorRows)
	require.Equal(t, dbgen.ImportStatusCOMPLETED, result.Status)

	// locA provisioned once and reused: capacity from the FIRST row (51), name is
	// the full location, type defaults to LECTURE_HALL, status ACTIVE.
	roomA, err := store.GetRoomByName(ctx, locA)
	require.NoError(t, err)
	require.EqualValues(t, 51, roomA.Capacity)
	require.Equal(t, dbgen.RoomTypeLECTUREHALL, roomA.RoomType)
	require.Equal(t, dbgen.RoomStatusACTIVE, roomA.Status)

	roomB, err := store.GetRoomByName(ctx, locB)
	require.NoError(t, err)
	require.EqualValues(t, 30, roomB.Capacity) // blank enrollments → default

	// Building provisioned by its derived name. locA is "Nutor Hall <suffix>", so
	// the last token (<suffix>) is the room number and the rest is the building.
	_, err = store.GetBuildingByName(ctx, "Nutor Hall")
	require.NoError(t, err)

	events, err := store.ListTimetableEvents(ctx, dbgen.ListTimetableEventsParams{SemesterID: &sem.ID})
	require.NoError(t, err)
	require.Len(t, events, 3)
	// Section/Program/Department captured on at least one event.
	var found bool
	for _, e := range events {
		if e.CourseCode == "BUSA220" {
			require.Equal(t, "Section A", e.Section)
			require.Equal(t, "BSc-BA", e.Program)
			require.Equal(t, "BA", e.Department)
			found = true
		}
	}
	require.True(t, found, "expected the BUSA220 event with captured fields")

	// Both locA rows share one room (created once, reused).
	roomAEvents, err := store.ListTimetableEvents(ctx, dbgen.ListTimetableEventsParams{SemesterID: &sem.ID, RoomID: &roomA.ID})
	require.NoError(t, err)
	require.Len(t, roomAEvents, 2)
}
