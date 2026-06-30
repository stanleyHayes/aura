package scheduling

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

// RawRow is one parsed spreadsheet line (§7.5 columns). The optional fields
// (Section/Program/Department/Enrollments) are carried straight from the real
// Ashesi export when present and are simply empty otherwise.
type RawRow struct {
	Line        int
	CourseCode  string
	CourseTitle string
	Lecturer    string
	Room        string
	Day         string
	Start       string
	End         string
	Section     string
	Program     string
	Department  string
	Enrollments string
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

// Canonical field keys (spec §7.5). These are the internal names; the actual
// spreadsheet header can be any of the accepted aliases below.
const (
	colCourseCode  = "course code"
	colCourseTitle = "course title"
	colLecturer    = "lecturer"
	colRoom        = "room"
	colDay         = "day"
	colStart       = "start time"
	colEnd         = "end time"

	// Optional fields — captured when present (absent is never an error).
	colSection     = "section"
	colProgram     = "program"
	colDepartment  = "department"
	colEnrollments = "number of enrollments"
)

// requiredAliases maps each required canonical field to the header names we will
// accept for it (lower-cased). The real Ashesi export names ("course name",
// "staff name", "location", "from time", "to time") sit alongside the canonical
// names so both shapes import cleanly.
var requiredAliases = map[string][]string{
	colCourseCode:  {"course code"},
	colCourseTitle: {"course title", "course name"},
	colLecturer:    {"lecturer", "lecturer name", "staff name"},
	colRoom:        {"room", "location"},
	colDay:         {"day"},
	colStart:       {"start time", "from time"},
	colEnd:         {"end time", "to time"},
}

// requiredOrder fixes the reporting order of required fields (maps are unordered).
var requiredOrder = []string{colCourseCode, colCourseTitle, colLecturer, colRoom, colDay, colStart, colEnd}

// optionalAliases maps each optional canonical field to its accepted headers.
var optionalAliases = map[string][]string{
	colSection:     {"section"},
	colProgram:     {"program"},
	colDepartment:  {"department"},
	colEnrollments: {"number of enrollments", "enrollments"},
}

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
			Section:     get(colSection),
			Program:     get(colProgram),
			Department:  get(colDepartment),
			Enrollments: get(colEnrollments),
		})
	}
	return rows, nil
}

// mapHeaders resolves every canonical field to the spreadsheet column that
// matched one of its accepted aliases (case-insensitively). Required fields must
// match; optional fields resolve when present and are simply absent otherwise.
// The returned map is keyed by the canonical field name, not the header text.
func mapHeaders(header []string) (map[string]int, error) {
	present := map[string]int{}
	for i, h := range header {
		present[strings.ToLower(strings.TrimSpace(h))] = i
	}

	resolve := func(aliases []string) (int, bool) {
		for _, a := range aliases {
			if c, ok := present[a]; ok {
				return c, true
			}
		}
		return 0, false
	}

	idx := map[string]int{}
	for _, field := range requiredOrder {
		c, ok := resolve(requiredAliases[field])
		if !ok {
			return nil, fmt.Errorf("missing required column %q (accepted: %s)", field, strings.Join(requiredAliases[field], ", "))
		}
		idx[field] = c
	}
	for field, aliases := range optionalAliases {
		if c, ok := resolve(aliases); ok {
			idx[field] = c
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
// duplicates. `rooms` caches rooms resolved (or provisioned) by location so many
// rows sharing a location reuse the same room and never create duplicates.
func (s *Service) validateRow(ctx context.Context, row RawRow, semesterID, importID uuid.UUID, seen map[string]bool, createMissing bool, rooms *roomResolver) (*dbgen.CreateTimetableEventParams, *RowError) {
	bad := func(field, msg string) *RowError { return &RowError{Row: row.Line, Field: field, Message: msg} }

	if row.CourseCode == "" {
		return nil, bad(colCourseCode, "required")
	}
	room, err := rooms.resolve(ctx, row, createMissing)
	if err != nil {
		return nil, bad(colRoom, err.Error())
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
		Section:      row.Section,
		Program:      row.Program,
		Department:   row.Department,
	}, nil
}

// ProcessImport validates and inserts rows for an import, recording per-row
// errors and the final status. Replace mode clears the semester's events first
// (bookings are never touched — the core design rule, §2). When createMissing is
// set, rooms (and their buildings) that the location names but the catalogue
// lacks are provisioned on the fly; provisioning failures become per-row errors,
// never a whole-import failure.
func (s *Service) ProcessImport(ctx context.Context, importID, semesterID uuid.UUID, rows []RawRow, mode ImportMode, createMissing bool) (dbgen.TimetableImport, error) {
	if mode == ModeReplace {
		if err := s.store.DeleteSemesterEvents(ctx, semesterID); err != nil {
			return s.failImport(ctx, importID, len(rows), fmt.Sprintf("clear existing events: %v", err))
		}
	}

	var rowErrs []RowError
	imported := 0
	seen := map[string]bool{}
	rooms := newRoomResolver(s.store)

	for _, row := range rows {
		params, rowErr := s.validateRow(ctx, row, semesterID, importID, seen, createMissing, rooms)
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

// defaultRoomCapacity seeds a provisioned room when the export carries no usable
// enrollment figure. Capacity must be > 0 (rooms.capacity CHECK), so we never
// provision a 0-capacity room.
const defaultRoomCapacity = 30

// roomResolver resolves a row's location to a catalogue room, optionally
// provisioning the building + room when the catalogue lacks it. It is scoped to a
// single ProcessImport so that resolved/created rooms are reused across rows
// (idempotency) and derived room codes stay unique within the run.
type roomResolver struct {
	store *db.Store
	// byLocation caches the resolved room per lower-cased location string.
	byLocation map[string]dbgen.Room
	// usedCodes tracks room codes created (or known-taken) during this run so a
	// freshly derived code can be made unique without a DB round-trip per try.
	usedCodes map[string]bool
}

func newRoomResolver(store *db.Store) *roomResolver {
	return &roomResolver{
		store:      store,
		byLocation: map[string]dbgen.Room{},
		usedCodes:  map[string]bool{},
	}
}

// resolve returns the room for row.Room, creating it (and its building) when
// createMissing is set and no match exists. The returned error is already
// per-row friendly.
func (rr *roomResolver) resolve(ctx context.Context, row RawRow, createMissing bool) (dbgen.Room, error) {
	loc := strings.TrimSpace(row.Room)
	if loc == "" {
		return dbgen.Room{}, errors.New("required")
	}
	key := strings.ToLower(loc)
	if r, ok := rr.byLocation[key]; ok {
		return r, nil
	}

	// (a) by code, then (b) by name (case-insensitive).
	if r, err := rr.store.GetRoomByCode(ctx, loc); err == nil {
		rr.remember(key, r)
		return r, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return dbgen.Room{}, fmt.Errorf("look up room %q: %v", loc, err)
	}
	if r, err := rr.store.GetRoomByName(ctx, loc); err == nil {
		rr.remember(key, r)
		return r, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return dbgen.Room{}, fmt.Errorf("look up room %q: %v", loc, err)
	}

	// (c) provision, or fail.
	if !createMissing {
		return dbgen.Room{}, fmt.Errorf("unknown room %q", loc)
	}
	r, err := rr.provision(ctx, loc, row.Enrollments)
	if err != nil {
		return dbgen.Room{}, fmt.Errorf("could not create room %q: %v", loc, err)
	}
	rr.remember(key, r)
	return r, nil
}

func (rr *roomResolver) remember(key string, r dbgen.Room) {
	rr.byLocation[key] = r
	rr.usedCodes[strings.ToLower(r.RoomCode)] = true
}

// provision creates the building (by name, get-or-create) and the room for a
// location string. The room name is the full location; capacity comes from the
// enrollment figure when usable.
func (rr *roomResolver) provision(ctx context.Context, loc, enrollments string) (dbgen.Room, error) {
	buildingName, roomNumber := splitLocation(loc)

	bld, err := rr.getOrCreateBuilding(ctx, buildingName)
	if err != nil {
		return dbgen.Room{}, err
	}

	capacity := defaultRoomCapacity
	if n, perr := strconv.Atoi(strings.TrimSpace(enrollments)); perr == nil && n > 0 {
		capacity = n
	}

	code := rr.uniqueRoomCode(buildingName, roomNumber)
	room, err := rr.store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode:   code,
		Name:       loc,
		BuildingID: bld.ID,
		Capacity:   int32(capacity),
		RoomType:   dbgen.RoomTypeLECTUREHALL,
		Status:     dbgen.RoomStatusACTIVE,
	})
	if err != nil {
		return dbgen.Room{}, err
	}
	return room, nil
}

// getOrCreateBuilding returns the building whose name matches (case-insensitive),
// creating it with a derived code and null campus when absent.
func (rr *roomResolver) getOrCreateBuilding(ctx context.Context, name string) (dbgen.Building, error) {
	if b, err := rr.store.GetBuildingByName(ctx, name); err == nil {
		return b, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return dbgen.Building{}, err
	}
	code := rr.uniqueBuildingCode(name)
	b, err := rr.store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: code, Name: name, Campus: nil})
	if err != nil {
		// A concurrent/duplicate creation can race the unique code; re-read by name.
		if b2, gerr := rr.store.GetBuildingByName(ctx, name); gerr == nil {
			return b2, nil
		}
		return dbgen.Building{}, err
	}
	return b, nil
}

// splitLocation parses a location into (building name, room number). The LAST
// whitespace-separated token is the room number/code; the rest is the building.
// "Nutor Hall 115" → ("Nutor Hall", "115"); "Norton-Motulsky 207A" →
// ("Norton-Motulsky", "207A"). A single-token location uses the whole string as
// the building name and an empty room number.
func splitLocation(loc string) (building, room string) {
	fields := strings.Fields(loc)
	if len(fields) <= 1 {
		return loc, ""
	}
	return strings.Join(fields[:len(fields)-1], " "), fields[len(fields)-1]
}

// uniqueRoomCode derives a sanitised, unique-within-run room code from the
// building initials and the room number, e.g. ("Nutor Hall","115") → "NH-115".
func (rr *roomResolver) uniqueRoomCode(buildingName, roomNumber string) string {
	base := sanitiseCode(buildingInitials(buildingName) + "-" + roomNumber)
	if base == "" || base == "-" {
		base = "ROOM"
	}
	return rr.makeUnique(base, rr.usedCodes)
}

// uniqueBuildingCode derives a sanitised, unique-within-run building code from
// the building name initials, e.g. "Nutor Hall" → "NH".
func (rr *roomResolver) uniqueBuildingCode(name string) string {
	base := sanitiseCode(buildingInitials(name))
	if base == "" {
		base = "BLD"
	}
	// Building codes share no namespace with room codes; track them in usedCodes
	// too so a derived value cannot collide with a room code created this run.
	return rr.makeUnique(base, rr.usedCodes)
}

// makeUnique returns base, or base with a numeric suffix, that is not already in
// used; it records the result in used.
func (rr *roomResolver) makeUnique(base string, used map[string]bool) string {
	candidate := base
	for i := 2; used[strings.ToLower(candidate)]; i++ {
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
	used[strings.ToLower(candidate)] = true
	return candidate
}

// buildingInitials takes the leading letter of each word, e.g. "Norton-Motulsky"
// → "NM" (hyphen splits words too), "Nutor Hall" → "NH".
func buildingInitials(name string) string {
	var b strings.Builder
	for _, word := range strings.FieldsFunc(name, func(r rune) bool {
		return r == ' ' || r == '-' || r == '_'
	}) {
		for _, r := range word {
			b.WriteRune(r)
			break
		}
	}
	return strings.ToUpper(b.String())
}

// sanitiseCode keeps A–Z, 0–9 and '-', upper-cases letters, and collapses any
// other run to a single '-'.
func sanitiseCode(s string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToUpper(s) {
		switch {
		case (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash {
				b.WriteRune('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
