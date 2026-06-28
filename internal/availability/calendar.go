package availability

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/aura/cbs/internal/catalogue"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// CalendarBlock is a single tagged block in the unified calendar (§7.7).
type CalendarBlock struct {
	Date   string    `json:"date"` // YYYY-MM-DD (institution-local)
	RoomID uuid.UUID `json:"room_id"`
	Source string    `json:"source"` // LECTURE | BOOKING | MAINTENANCE | AVAILABLE
	Status string    `json:"status,omitempty"`
	Label  string    `json:"label"`
	Start  string    `json:"start"` // HH:MM
	End    string    `json:"end"`   // HH:MM
}

// CalendarQuery selects the view window and scope.
type CalendarQuery struct {
	View       string // day | week | month
	Date       time.Time
	RoomID     *uuid.UUID
	BuildingID *uuid.UUID
}

// Calendar returns lecture/booking/maintenance blocks plus computed AVAILABLE
// gaps for the requested range and scope (FR10).
func (e *Engine) Calendar(ctx context.Context, q CalendarQuery) ([]CalendarBlock, error) {
	from, to := rangeFor(q.View, q.Date)

	rooms, err := e.scopeRooms(ctx, q)
	if err != nil {
		return nil, err
	}

	blocks := []CalendarBlock{}
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		day := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, e.loc)
		dateStr := day.Format("2006-01-02")
		weekday := weekdayEnum[int(day.Weekday())]
		dayStart, dayEnd := day, day.Add(24*time.Hour)

		for _, room := range rooms {
			var occ []Interval

			lectures, err := e.store.Read.ListRoomLecturesOnDay(ctx, dbgen.ListRoomLecturesOnDayParams{
				RoomID: room.ID, Day: weekday, OnDate: pgconv.Date(day),
			})
			if err != nil {
				return nil, err
			}
			for _, lec := range lectures {
				iv := timeRange(lec.StartTime, lec.EndTime)
				occ = append(occ, iv)
				blocks = append(blocks, block(dateStr, room.ID, "LECTURE", "",
					fmt.Sprintf("%s %s", lec.CourseCode, lec.CourseTitle), iv))
			}

			bookings, err := e.store.Read.ListBookings(ctx, dbgen.ListBookingsParams{
				RoomID: &room.ID, FromTs: pgconv.TS(dayStart), ToTs: pgconv.TS(dayEnd), Lim: 500,
			})
			if err != nil {
				return nil, err
			}
			for _, b := range bookings {
				if b.Status != dbgen.BookingStatusAPPROVED && b.Status != dbgen.BookingStatusPENDING {
					continue
				}
				iv := clampToDay(b.StartsAt.Time, b.EndsAt.Time, day, e.loc)
				if b.Status == dbgen.BookingStatusAPPROVED {
					occ = append(occ, iv)
				}
				blocks = append(blocks, block(dateStr, room.ID, "BOOKING", string(b.Status), b.Purpose, iv))
			}

			maint, err := e.store.Read.ListMaintenanceForRoomInRange(ctx, dbgen.ListMaintenanceForRoomInRangeParams{
				RoomID: room.ID, DayStart: pgconv.TS(dayStart), DayEnd: pgconv.TS(dayEnd),
			})
			if err != nil {
				return nil, err
			}
			for _, m := range maint {
				iv := clampToDay(m.StartsAt.Time, m.EndsAt.Time, day, e.loc)
				occ = append(occ, iv)
				blocks = append(blocks, block(dateStr, room.ID, "MAINTENANCE", "", m.Reason, iv))
			}

			for _, free := range Subtract(Interval{0, 1440}, occ) {
				blocks = append(blocks, block(dateStr, room.ID, "AVAILABLE", "", "Available", free))
			}
		}
	}
	return blocks, nil
}

func (e *Engine) scopeRooms(ctx context.Context, q CalendarQuery) ([]catalogue.RoomDetail, error) {
	if q.RoomID != nil {
		room, err := e.rooms.GetRoom(ctx, *q.RoomID)
		if err != nil {
			return nil, err
		}
		return []catalogue.RoomDetail{{Room: room}}, nil
	}
	f := catalogue.RoomFilter{BuildingID: q.BuildingID, Limit: 200}
	return e.rooms.SearchRooms(ctx, f)
}

func rangeFor(view string, date time.Time) (from, to time.Time) {
	d := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	switch view {
	case "week":
		// ISO week: Monday start.
		offset := (int(d.Weekday()) + 6) % 7
		from = d.AddDate(0, 0, -offset)
		to = from.AddDate(0, 0, 6)
	case "month":
		from = time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, d.Location())
		to = from.AddDate(0, 1, -1)
	default: // day
		from, to = d, d
	}
	return from, to
}

func timeRange(start, end pgtype.Time) Interval {
	sh, sm := pgconv.PgTimeToClock(start)
	eh, em := pgconv.PgTimeToClock(end)
	return Interval{Start: sh*60 + sm, End: eh*60 + em}
}

func block(date string, roomID uuid.UUID, source, status, label string, iv Interval) CalendarBlock {
	return CalendarBlock{
		Date: date, RoomID: roomID, Source: source, Status: status, Label: label,
		Start: clock(iv.Start), End: clock(iv.End),
	}
}

func clock(min int) string { return fmt.Sprintf("%02d:%02d", min/60, min%60) }
