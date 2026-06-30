package scheduling

import (
	"bytes"
	"strconv"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

// buildXLSX returns an in-memory .xlsx with the required header and dataRows data
// rows on the first worksheet.
func buildXLSX(t *testing.T, dataRows int) []byte {
	t.Helper()
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	sheet := f.GetSheetName(0)
	header := []string{"Course Code", "Course Title", "Lecturer", "Room", "Day", "Start Time", "End Time"}
	if err := f.SetSheetRow(sheet, "A1", &header); err != nil {
		t.Fatalf("set header: %v", err)
	}
	for i := 0; i < dataRows; i++ {
		row := []string{"CS" + strconv.Itoa(i), "Title", "Lect", "R-1", "MON", "08:00", "09:00"}
		cell := "A" + strconv.Itoa(i+2)
		if err := f.SetSheetRow(sheet, cell, &row); err != nil {
			t.Fatalf("set row %d: %v", i, err)
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write xlsx: %v", err)
	}
	return buf.Bytes()
}

func TestReadXLSXHappyPath(t *testing.T) {
	data := buildXLSX(t, 3)
	rows, err := ReadXLSX(data)
	if err != nil {
		t.Fatalf("ReadXLSX: %v", err)
	}
	if len(rows) != 3 {
		t.Fatalf("got %d rows, want 3", len(rows))
	}
	if rows[0].CourseCode != "CS0" || rows[0].Room != "R-1" {
		t.Fatalf("unexpected first row: %+v", rows[0])
	}
}

func TestReadXLSXRowCap(t *testing.T) {
	// One header + maxImportRows data rows exceeds the cap (which counts the header).
	data := buildXLSX(t, maxImportRows)
	_, err := ReadXLSX(data)
	if err == nil {
		t.Fatal("expected an error when the row cap is exceeded")
	}
}

// TestReadCSVRealExportAliases verifies the real Ashesi export headers (Course
// Name, Staff Name, Location, From Time, To Time, plus optional Section/Program/
// Department/Number of Enrollments) map onto the canonical fields, regardless of
// case, and that the optional fields are captured.
func TestReadCSVRealExportAliases(t *testing.T) {
	csv := "Day,From Time,To Time,Location,Course Code,Course Name,Staff Name,Section,Program,Department,Number of Enrollments\n" +
		"Monday,08:00,09:30,Nutor Hall 115,BUSA220,Introduction to Finance,Nana Kwasi Karikari,Section A,BSc-BA,BA,51\n"
	rows, err := ReadCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ReadCSV: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	r := rows[0]
	if r.CourseCode != "BUSA220" || r.CourseTitle != "Introduction to Finance" {
		t.Fatalf("course mapping wrong: %+v", r)
	}
	if r.Lecturer != "Nana Kwasi Karikari" || r.Room != "Nutor Hall 115" {
		t.Fatalf("lecturer/room mapping wrong: %+v", r)
	}
	if r.Day != "Monday" || r.Start != "08:00" || r.End != "09:30" {
		t.Fatalf("day/time mapping wrong: %+v", r)
	}
	if r.Section != "Section A" || r.Program != "BSc-BA" || r.Department != "BA" || r.Enrollments != "51" {
		t.Fatalf("optional field mapping wrong: %+v", r)
	}
}

// TestReadCSVMissingRequiredColumn confirms a missing required field is rejected
// with the accepted aliases listed.
func TestReadCSVMissingRequiredColumn(t *testing.T) {
	// No room/location column.
	csv := "Course Code,Course Name,Staff Name,Day,From Time,To Time\nX1,T,L,MON,08:00,09:00\n"
	_, err := ReadCSV(strings.NewReader(csv))
	if err == nil {
		t.Fatal("expected an error for the missing room column")
	}
	if !strings.Contains(err.Error(), "location") {
		t.Fatalf("error should list accepted aliases, got: %v", err)
	}
}

func TestSplitLocation(t *testing.T) {
	cases := []struct {
		loc, wantBuilding, wantRoom string
	}{
		{"Nutor Hall 115", "Nutor Hall", "115"},
		{"Norton-Motulsky 207A", "Norton-Motulsky", "207A"},
		{"Auditorium", "Auditorium", ""},
		{"  Jackson Hall  12B ", "Jackson Hall", "12B"},
	}
	for _, c := range cases {
		b, r := splitLocation(strings.TrimSpace(c.loc))
		if b != c.wantBuilding || r != c.wantRoom {
			t.Errorf("splitLocation(%q) = (%q,%q), want (%q,%q)", c.loc, b, r, c.wantBuilding, c.wantRoom)
		}
	}
}

func TestUniqueRoomCode(t *testing.T) {
	rr := newRoomResolver(nil)
	if got := rr.uniqueRoomCode("Nutor Hall", "115"); got != "NH-115" {
		t.Fatalf("first code = %q, want NH-115", got)
	}
	// Same derived code again must be made unique within the run.
	if got := rr.uniqueRoomCode("Nutor Hall", "115"); got != "NH-115-2" {
		t.Fatalf("second code = %q, want NH-115-2", got)
	}
	if got := rr.uniqueRoomCode("Norton-Motulsky", "207A"); got != "NM-207A" {
		t.Fatalf("hyphen building code = %q, want NM-207A", got)
	}
}
