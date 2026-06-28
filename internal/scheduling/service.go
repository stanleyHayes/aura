// Package scheduling owns semesters, lecture timetable events, and timetable
// ingestion (§6.5, §7.5, FR3/FR4). Lecture occupancy is stored entirely
// separately from booking occupancy — replacing a timetable never touches
// bookings (the central design decision, §2).
package scheduling

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

type Service struct {
	store *db.Store
}

func NewService(store *db.Store) *Service { return &Service{store: store} }

// ── Semesters ────────────────────────────────────────────────────────────────

type SemesterInput struct {
	Name      string
	StartDate time.Time
	EndDate   time.Time
}

func (s *Service) CreateSemester(ctx context.Context, in SemesterInput) (dbgen.Semester, error) {
	if !in.EndDate.After(in.StartDate) {
		return dbgen.Semester{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end_date", Message: "must be after start_date"})
	}
	sem, err := s.store.CreateSemester(ctx, dbgen.CreateSemesterParams{
		Name: in.Name, StartDate: pgconv.Date(in.StartDate), EndDate: pgconv.Date(in.EndDate), Status: dbgen.SemesterStatusDRAFT,
	})
	return sem, db.MapError(err)
}

func (s *Service) GetSemester(ctx context.Context, id uuid.UUID) (dbgen.Semester, error) {
	return s.store.GetSemester(ctx, id)
}

func (s *Service) ListSemesters(ctx context.Context) ([]dbgen.Semester, error) {
	return s.store.ListSemesters(ctx)
}

func (s *Service) UpdateSemester(ctx context.Context, id uuid.UUID, in SemesterInput) (dbgen.Semester, error) {
	sem, err := s.store.UpdateSemester(ctx, dbgen.UpdateSemesterParams{
		ID: id, Name: in.Name, StartDate: pgconv.Date(in.StartDate), EndDate: pgconv.Date(in.EndDate),
	})
	return sem, db.MapError(err)
}

// Activate sets a semester ACTIVE. The partial unique index uq_one_active_semester
// (BR2) guarantees at most one active semester; a second activation maps to a
// clear conflict error rather than a raw constraint violation.
func (s *Service) Activate(ctx context.Context, id uuid.UUID) (dbgen.Semester, error) {
	sem, err := s.store.SetSemesterStatus(ctx, dbgen.SetSemesterStatusParams{ID: id, Status: dbgen.SemesterStatusACTIVE})
	return sem, db.MapError(err)
}

func (s *Service) Archive(ctx context.Context, id uuid.UUID) (dbgen.Semester, error) {
	sem, err := s.store.SetSemesterStatus(ctx, dbgen.SetSemesterStatusParams{ID: id, Status: dbgen.SemesterStatusARCHIVED})
	return sem, db.MapError(err)
}

func (s *Service) DeleteSemester(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteSemester(ctx, id))
}

// ── Timetable events (manual entry/edit, FR4) ────────────────────────────────

type EventInput struct {
	SemesterID   uuid.UUID
	RoomID       uuid.UUID
	CourseCode   string
	CourseTitle  string
	LecturerName string
	Day          dbgen.DayOfWeek
	StartHour    int
	StartMin     int
	EndHour      int
	EndMin       int
}

func (s *Service) CreateEvent(ctx context.Context, in EventInput) (dbgen.TimetableEvent, error) {
	if (in.EndHour*60 + in.EndMin) <= (in.StartHour*60 + in.StartMin) {
		return dbgen.TimetableEvent{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end_time", Message: "must be after start_time"})
	}
	ev, err := s.store.CreateTimetableEvent(ctx, dbgen.CreateTimetableEventParams{
		SemesterID: in.SemesterID, RoomID: in.RoomID, CourseCode: in.CourseCode, CourseTitle: in.CourseTitle,
		LecturerName: in.LecturerName, Day: in.Day,
		StartTime: pgconv.ClockToPgTime(in.StartHour, in.StartMin, 0),
		EndTime:   pgconv.ClockToPgTime(in.EndHour, in.EndMin, 0),
	})
	return ev, db.MapError(err)
}

func (s *Service) UpdateEvent(ctx context.Context, id uuid.UUID, in EventInput) (dbgen.TimetableEvent, error) {
	ev, err := s.store.UpdateTimetableEvent(ctx, dbgen.UpdateTimetableEventParams{
		ID: id, RoomID: in.RoomID, CourseCode: in.CourseCode, CourseTitle: in.CourseTitle,
		LecturerName: in.LecturerName, Day: in.Day,
		StartTime: pgconv.ClockToPgTime(in.StartHour, in.StartMin, 0),
		EndTime:   pgconv.ClockToPgTime(in.EndHour, in.EndMin, 0),
	})
	return ev, db.MapError(err)
}

func (s *Service) DeleteEvent(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteTimetableEvent(ctx, id))
}

func (s *Service) ListEvents(ctx context.Context, p dbgen.ListTimetableEventsParams) ([]dbgen.TimetableEvent, error) {
	return s.store.ListTimetableEvents(ctx, p)
}

// ── Imports ──────────────────────────────────────────────────────────────────

func (s *Service) CreateImport(ctx context.Context, semesterID, uploadedBy uuid.UUID, method dbgen.ImportMethod, objectKey *string) (dbgen.TimetableImport, error) {
	imp, err := s.store.CreateTimetableImport(ctx, dbgen.CreateTimetableImportParams{
		SemesterID: semesterID, UploadedBy: uploadedBy, Method: method, FileObjectKey: objectKey,
	})
	return imp, db.MapError(err)
}

func (s *Service) GetImport(ctx context.Context, id uuid.UUID) (dbgen.TimetableImport, error) {
	return s.store.GetTimetableImport(ctx, id)
}
