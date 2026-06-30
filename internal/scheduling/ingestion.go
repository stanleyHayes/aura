package scheduling

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"

	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/metrics"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// maxImportRows caps the number of data rows (including the header) we will read
// from an uploaded spreadsheet. Together with UnzipSizeLimit this bounds the work
// an attacker can force with a decompression bomb (§14 DoS).
const maxImportRows = 20000

// RawRow is one parsed spreadsheet line (§7.5 columns).
type RawRow struct {
	Line        int
	CourseCode  string
	CourseTitle string
	Lecturer    string
	Room        string
	Day         string
	Start       string
	End         string
}

// RowError is a per-row validation failure recorded in import.error_report.
type RowError struct {
	Row     int    `json:"row"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ImportMode controls whether existing events for the semester are replaced.
type ImportMode string

const (
	ModeReplace ImportMode = "replace"
	ModeAppend  ImportMode = "append"
)

// Column header names (spec §7.5), lower-cased for case-insensitive matching.
const (
	colCourseCode  = "course code"
	colCourseTitle = "course title"
	colLecturer    = "lecturer"
	colRoom        = "room"
	colDay         = "day"
	colStart       = "start time"
	colEnd         = "end time"
)

var wantHeaders = []string{colCourseCode, colCourseTitle, colLecturer, colRoom, colDay, colStart, colEnd}

// ReadCSV parses a CSV body into rows, validating the header.
func ReadCSV(r io.Reader) ([]RawRow, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	cr.TrimLeadingSpace = true
	records, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read csv: %w", err)
	}
	return recordsToRows(records)
}

// ReadXLSX parses the first worksheet of an .xlsx body into rows. It bounds both
// the decompressed archive size (UnzipSizeLimit) and the number of rows it will
// materialise (maxImportRows) so a malicious upload cannot exhaust memory (§14).
func ReadXLSX(data []byte) ([]RawRow, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data), excelize.Options{UnzipSizeLimit: 64 << 20})
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	defer func() { _ = f.Close() }()
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, errors.New("xlsx has no sheets")
	}
	rows, err := f.Rows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var records [][]string
	for rows.Next() {
		if len(records) >= maxImportRows {
			return nil, fmt.Errorf("spreadsheet exceeds the maximum of %d rows", maxImportRows)
		}
		cols, err := rows.Columns()
		if err != nil {
			return nil, fmt.Errorf("read row: %w", err)
		}
		records = append(records, cols)
	}
	if err := rows.Error(); err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}
	return recordsToRows(records)
}

func recordsToRows(records [][]string) ([]RawRow, error) {
	if len(records) < 1 {
		return nil, errors.New("file is empty")
	}
	idx, err := mapHeaders(records[0])
	if err != nil {
		return nil, err
	}
	var rows []RawRow
	for i := 1; i < len(records); i++ {
		rec := records[i]
		if isBlank(rec) {
			continue
		}
		get := func(key string) string {
			if c, ok := idx[key]; ok && c < len(rec) {
				return strings.TrimSpace(rec[c])
			}
			return ""
		}
		rows = append(rows, RawRow{
			Line:        i + 1, // 1-based, accounting for header
			CourseCode:  get(colCourseCode),
			CourseTitle: get(colCourseTitle),
			Lecturer:    get(colLecturer),
			Room:        get(colRoom),
			Day:         get(colDay),
			Start:       get(colStart),
			End:         get(colEnd),
		})
	}
	return rows, nil
}

func mapHeaders(header []string) (map[string]int, error) {
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	for _, want := range wantHeaders {
		if _, ok := idx[want]; !ok {
			return nil, fmt.Errorf("missing required column %q", want)
		}
	}
	return idx, nil
}

func isBlank(rec []string) bool {
	for _, c := range rec {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

// validateRow parses and validates one upload row, returning insert params or a
// per-row error. It records the row's signature in `seen` to detect in-upload
// duplicates.
func (s *Service) validateRow(ctx context.Context, row RawRow, semesterID, importID uuid.UUID, seen map[string]bool) (*dbgen.CreateTimetableEventParams, *RowError) {
	bad := func(field, msg string) *RowError { return &RowError{Row: row.Line, Field: field, Message: msg} }

	if row.CourseCode == "" {
		return nil, bad(colCourseCode, "required")
	}
	room, err := s.store.GetRoomByCode(ctx, row.Room)
	if err != nil {
		return nil, bad(colRoom, fmt.Sprintf("unknown room code %q", row.Room))
	}
	day, err := ParseDay(row.Day)
	if err != nil {
		return nil, bad(colDay, err.Error())
	}
	sh, sm, err := ParseClock(row.Start)
	if err != nil {
		return nil, bad(colStart, err.Error())
	}
	eh, em, err := ParseClock(row.End)
	if err != nil {
		return nil, bad(colEnd, err.Error())
	}
	if (eh*60 + em) <= (sh*60 + sm) {
		return nil, bad(colEnd, "end time must be after start time")
	}

	dupKey := fmt.Sprintf("%s|%s|%02d%02d|%02d%02d", room.ID, day, sh, sm, eh, em)
	if seen[dupKey] {
		return nil, bad("row", "duplicate of an earlier row in this upload")
	}
	seen[dupKey] = true

	return &dbgen.CreateTimetableEventParams{
		SemesterID:   semesterID,
		ImportID:     &importID,
		RoomID:       room.ID,
		CourseCode:   row.CourseCode,
		CourseTitle:  row.CourseTitle,
		LecturerName: row.Lecturer,
		Day:          day,
		StartTime:    pgconv.ClockToPgTime(sh, sm, 0),
		EndTime:      pgconv.ClockToPgTime(eh, em, 0),
	}, nil
}

// ProcessImport validates and inserts rows for an import, recording per-row
// errors and the final status. Replace mode clears the semester's events first
// (bookings are never touched — the core design rule, §2).
func (s *Service) ProcessImport(ctx context.Context, importID, semesterID uuid.UUID, rows []RawRow, mode ImportMode) (dbgen.TimetableImport, error) {
	if mode == ModeReplace {
		if err := s.store.DeleteSemesterEvents(ctx, semesterID); err != nil {
			return s.failImport(ctx, importID, len(rows), fmt.Sprintf("clear existing events: %v", err))
		}
	}

	var rowErrs []RowError
	imported := 0
	seen := map[string]bool{}

	for _, row := range rows {
		params, rowErr := s.validateRow(ctx, row, semesterID, importID, seen)
		if rowErr != nil {
			rowErrs = append(rowErrs, *rowErr)
			continue
		}
		if _, err := s.store.CreateTimetableEvent(ctx, *params); err != nil {
			rowErrs = append(rowErrs, RowError{Row: row.Line, Field: "row", Message: fmt.Sprintf("could not insert: %v", db.MapError(err))})
			continue
		}
		imported++
	}

	status := dbgen.ImportStatusCOMPLETED
	switch {
	case imported == 0 && len(rows) > 0:
		status = dbgen.ImportStatusFAILED
	case len(rowErrs) > 0:
		status = dbgen.ImportStatusPARTIALLYCOMPLETED
	}

	metrics.ImportProcessed(string(status))
	report, _ := json.Marshal(rowErrs)
	return s.store.UpdateImportProgress(ctx, dbgen.UpdateImportProgressParams{
		ID:           importID,
		Status:       status,
		TotalRows:    int32(len(rows)),
		ImportedRows: int32(imported),
		ErrorRows:    int32(len(rowErrs)),
		ErrorReport:  report,
		CompletedAt:  pgconv.TS(time.Now()),
	})
}

func (s *Service) failImport(ctx context.Context, importID uuid.UUID, total int, msg string) (dbgen.TimetableImport, error) {
	report, _ := json.Marshal([]RowError{{Row: 0, Field: "file", Message: msg}})
	return s.store.UpdateImportProgress(ctx, dbgen.UpdateImportProgressParams{
		ID:          importID,
		Status:      dbgen.ImportStatusFAILED,
		TotalRows:   int32(total),
		ErrorRows:   int32(total),
		ErrorReport: report,
		CompletedAt: pgconv.TS(time.Now()),
	})
}
