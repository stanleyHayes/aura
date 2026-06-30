package bookings_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// findApprovability returns the approvability row for a booking id from a list.
func findApprovability(t *testing.T, items []bookings.Approvability, id uuid.UUID) bookings.Approvability {
	t.Helper()
	for _, it := range items {
		if it.Booking.ID == id {
			return it
		}
	}
	t.Fatalf("booking %s not present in approvability list", id)
	return bookings.Approvability{}
}

// hasBlocker reports whether a kind appears in the blocker list.
func hasBlocker(blockers []bookings.ApprovalBlocker, kind string) bool {
	for _, b := range blockers {
		if string(b.Kind) == kind {
			return true
		}
	}
	return false
}

// insertRawPending inserts a PENDING booking directly, bypassing the validation
// trigger (so we can stage rows that are in the past or over capacity — states
// the trigger rejects at submission but that the approvals queue must still
// surface). session_replication_role='replica' disables user triggers for the
// connection, scoped to a transaction so it never leaks.
func insertRawPending(t *testing.T, f fixture, roomID, requester uuid.UUID, attendees int, start, end time.Time) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	tx, err := f.store.Pool.Begin(ctx)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, "SET LOCAL session_replication_role = replica")
	require.NoError(t, err)
	var id uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO bookings (room_id, requested_by, purpose, attendee_count, starts_at, ends_at, status)
		 VALUES ($1,$2,$3,$4,$5,$6,'PENDING') RETURNING id`,
		roomID, requester, "Raw pending", attendees, start, end).Scan(&id)
	require.NoError(t, err)
	require.NoError(t, tx.Commit(ctx))
	return id
}

// TestPendingApprovabilityCleanAndConflicts covers the §11/FR8 enrichment: a
// clean request is approvable; a request overlapping an APPROVED booking is
// blocked with APPROVED_BOOKING; an over-capacity request gets CAPACITY; a past
// request gets IN_PAST. The enriched booking also carries nested room/requester.
func TestPendingApprovabilityCleanAndConflicts(t *testing.T) {
	f := newFixture(t, 20)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()

	// Give the requester a department so the nested requester.department is
	// populated (the approvals queue renders requester.department.name).
	dept, err := f.store.CreateDepartment(ctx, dbgen.CreateDepartmentParams{
		Code: "D-" + uuid.NewString()[:8], Name: "Computer Science",
	})
	require.NoError(t, err)
	_, err = f.store.Pool.Exec(ctx, "UPDATE users SET department_id=$1 WHERE id=$2", dept.ID, f.requester)
	require.NoError(t, err)

	// 1) A clean pending booking on its own slot.
	cleanStart, cleanEnd := f.tomorrowWindow(8, 9)
	clean, err := svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Clean request",
		AttendeeCount: 10, StartsAt: cleanStart, EndsAt: cleanEnd,
	})
	require.NoError(t, err)

	// 2) A pending booking that overlaps an APPROVED booking.
	conflictStart, conflictEnd := f.tomorrowWindow(10, 12)
	approved, err := svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Will be approved",
		AttendeeCount: 10, StartsAt: conflictStart, EndsAt: conflictEnd,
	})
	require.NoError(t, err)
	overlapping, err := svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Overlaps an approved booking",
		AttendeeCount: 10, StartsAt: conflictStart, EndsAt: conflictEnd,
	})
	require.NoError(t, err)
	_, err = svc.Approve(ctx, approved.Booking.ID, f.officer, nil)
	require.NoError(t, err)

	// 3) An over-capacity pending booking (room capacity is 20).
	overCapStart, overCapEnd := f.tomorrowWindow(13, 14)
	overCap := insertRawPending(t, f, f.roomID, f.requester, 999, overCapStart, overCapEnd)

	// 4) A past pending booking.
	past := time.Now().In(f.loc).Add(-3 * time.Hour)
	pastID := insertRawPending(t, f, f.roomID, f.requester, 5, past, past.Add(time.Hour))

	items, err := svc.PendingApprovability(ctx, dbgen.ListPendingForApprovalParams{
		RoomID: &f.roomID, Lim: 100,
	})
	require.NoError(t, err)

	// Clean → approvable, no hard blockers, enriched with nested relations.
	cleanItem := findApprovability(t, items, clean.Booking.ID)
	require.True(t, cleanItem.CanApprove, "a clean pending booking must be approvable")
	require.False(t, hasBlocker(cleanItem.Blockers, "IN_PAST"))
	require.False(t, hasBlocker(cleanItem.Blockers, "CAPACITY"))
	require.False(t, hasBlocker(cleanItem.Blockers, "LECTURE"))
	require.False(t, hasBlocker(cleanItem.Blockers, "MAINTENANCE"))
	require.False(t, hasBlocker(cleanItem.Blockers, "APPROVED_BOOKING"))
	require.NotNil(t, cleanItem.Booking.Room, "enriched booking must carry nested room")
	require.Equal(t, "Test Room", cleanItem.Booking.Room.Name)
	require.NotEmpty(t, cleanItem.Booking.Room.RoomCode)
	require.NotNil(t, cleanItem.Booking.Requester, "enriched booking must carry requester")
	require.Equal(t, "Requester", cleanItem.Booking.Requester.FullName)
	require.NotNil(t, cleanItem.Booking.Requester.Department)
	require.Equal(t, "Computer Science", cleanItem.Booking.Requester.Department.Name)

	// Overlapping → blocked with APPROVED_BOOKING.
	overlapItem := findApprovability(t, items, overlapping.Booking.ID)
	require.False(t, overlapItem.CanApprove, "a booking overlapping an approved one must be blocked")
	require.True(t, hasBlocker(overlapItem.Blockers, "APPROVED_BOOKING"))

	// Over-capacity → CAPACITY blocker, not approvable.
	overCapItem := findApprovability(t, items, overCap)
	require.False(t, overCapItem.CanApprove)
	require.True(t, hasBlocker(overCapItem.Blockers, "CAPACITY"))

	// Past → IN_PAST blocker, not approvable.
	pastItem := findApprovability(t, items, pastID)
	require.False(t, pastItem.CanApprove)
	require.True(t, hasBlocker(pastItem.Blockers, "IN_PAST"))
}

// TestPendingApprovabilityCompetingPendingIsSoft verifies that competing pending
// requests are surfaced (competing_pending_count + COMPETING_PENDING blocker)
// but do NOT, on their own, block approval (BR5).
func TestPendingApprovabilityCompetingPendingIsSoft(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()

	start, end := f.tomorrowWindow(15, 17)
	a, err := svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "First",
		AttendeeCount: 10, StartsAt: start, EndsAt: end,
	})
	require.NoError(t, err)
	_, err = svc.Create(ctx, bookings.CreateInput{
		RoomID: f.roomID, RequestedBy: f.requester, Purpose: "Second (competes)",
		AttendeeCount: 10, StartsAt: start, EndsAt: end,
	})
	require.NoError(t, err)

	items, err := svc.PendingApprovability(ctx, dbgen.ListPendingForApprovalParams{
		RoomID: &f.roomID, Lim: 100,
	})
	require.NoError(t, err)

	item := findApprovability(t, items, a.Booking.ID)
	require.True(t, item.CanApprove, "competing pendings alone must not block approval")
	require.Equal(t, int64(1), item.CompetingPendingCount)
	require.True(t, hasBlocker(item.Blockers, "COMPETING_PENDING"))
}

// TestPendingApprovabilityLectureAndMaintenance verifies the LECTURE and
// MAINTENANCE hard blockers are surfaced for a pending request that overlaps an
// active-semester lecture / a maintenance window on the same room.
func TestPendingApprovabilityLectureAndMaintenance(t *testing.T) {
	f := newFixture(t, 50)
	svc := bookings.NewService(f.store, f.loc, nil)
	ctx := context.Background()

	// MAINTENANCE: window overlapping a future request's slot.
	mStart, mEnd := f.tomorrowWindow(9, 12)
	_, err := svc.CreateMaintenance(ctx, f.roomID, mStart, mEnd, "Projector repair", f.officer)
	require.NoError(t, err)
	maintBooking := insertRawPending(t, f, f.roomID, f.requester, 10, mStart, mEnd)

	// LECTURE: an active semester + a lecture on the room for the target weekday.
	_, err = f.store.Pool.Exec(ctx, "UPDATE semesters SET status='ARCHIVED' WHERE status='ACTIVE'")
	require.NoError(t, err)
	lecStart, lecEnd := f.tomorrowWindow(14, 16)
	sem, err := f.store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name:      "Sem " + uuid.NewString()[:6],
		StartDate: pgconv.Date(lecStart.AddDate(0, 0, -30)), EndDate: pgconv.Date(lecStart.AddDate(0, 0, 30)),
		Status: dbgen.SemesterStatusDRAFT,
	})
	require.NoError(t, err)
	_, err = f.store.SetSemesterStatus(ctx, dbgen.SetSemesterStatusParams{ID: sem.ID, Status: dbgen.SemesterStatusACTIVE})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = f.store.Pool.Exec(context.Background(), "UPDATE semesters SET status='ARCHIVED' WHERE id=$1", sem.ID)
	})
	_, err = f.store.CreateTimetableEvent(ctx, dbgen.CreateTimetableEventParams{
		SemesterID: sem.ID, RoomID: f.roomID, CourseCode: "CS999", CourseTitle: "Conflicting",
		LecturerName: "Dr Y", Day: weekdayCode(lecStart),
		StartTime: pgconv.ClockToPgTime(13, 0, 0), EndTime: pgconv.ClockToPgTime(15, 0, 0), // overlaps 14–16
	})
	require.NoError(t, err)
	lectureBooking := insertRawPending(t, f, f.roomID, f.requester, 10, lecStart, lecEnd)

	items, err := svc.PendingApprovability(ctx, dbgen.ListPendingForApprovalParams{
		RoomID: &f.roomID, Lim: 100,
	})
	require.NoError(t, err)

	mItem := findApprovability(t, items, maintBooking)
	require.False(t, mItem.CanApprove)
	require.True(t, hasBlocker(mItem.Blockers, "MAINTENANCE"))

	lItem := findApprovability(t, items, lectureBooking)
	require.False(t, lItem.CanApprove)
	require.True(t, hasBlocker(lItem.Blockers, "LECTURE"))
}
