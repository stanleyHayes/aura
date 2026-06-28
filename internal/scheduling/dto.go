package scheduling

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// SemesterView renders dates as YYYY-MM-DD for the API.
type SemesterView struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	StartDate string    `json:"start_date"`
	EndDate   string    `json:"end_date"`
	Status    string    `json:"status"`
}

func ToSemesterView(s dbgen.Semester) SemesterView {
	return SemesterView{
		ID:        s.ID,
		Name:      s.Name,
		StartDate: pgconv.DateVal(s.StartDate).Format("2006-01-02"),
		EndDate:   pgconv.DateVal(s.EndDate).Format("2006-01-02"),
		Status:    string(s.Status),
	}
}

// EventView renders times as HH:MM for the API.
type EventView struct {
	ID           uuid.UUID  `json:"id"`
	SemesterID   uuid.UUID  `json:"semester_id"`
	RoomID       uuid.UUID  `json:"room_id"`
	CourseCode   string     `json:"course_code"`
	CourseTitle  string     `json:"course_title"`
	LecturerName string     `json:"lecturer_name"`
	Day          string     `json:"day"`
	StartTime    string     `json:"start_time"`
	EndTime      string     `json:"end_time"`
	ImportID     *uuid.UUID `json:"import_id"`
}

func ToEventView(e dbgen.TimetableEvent) EventView {
	sh, sm := pgconv.PgTimeToClock(e.StartTime)
	eh, em := pgconv.PgTimeToClock(e.EndTime)
	return EventView{
		ID: e.ID, SemesterID: e.SemesterID, RoomID: e.RoomID,
		CourseCode: e.CourseCode, CourseTitle: e.CourseTitle, LecturerName: e.LecturerName,
		Day:       string(e.Day),
		StartTime: fmt.Sprintf("%02d:%02d", sh, sm),
		EndTime:   fmt.Sprintf("%02d:%02d", eh, em),
		ImportID:  e.ImportID,
	}
}
