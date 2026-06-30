package scheduling

import (
	"bytes"
	"strconv"
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
