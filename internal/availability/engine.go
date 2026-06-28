package availability

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/catalogue"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/metrics"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// weekdayEnum maps Go's Weekday (Sun=0) to the day_of_week enum, matching the
// ordering used by the booking validation trigger (§6.7).
var weekdayEnum = [...]dbgen.DayOfWeek{
	dbgen.DayOfWeekSUN, dbgen.DayOfWeekMON, dbgen.DayOfWeekTUE, dbgen.DayOfWeekWED,
	dbgen.DayOfWeekTHU, dbgen.DayOfWeekFRI, dbgen.DayOfWeekSAT,
}

// WeekdayEnum returns the day_of_week enum for a date's weekday.
func WeekdayEnum(day time.Time) dbgen.DayOfWeek { return weekdayEnum[int(day.Weekday())] }

// Engine derives availability from lectures + approved bookings + maintenance.
// It reads only (ideally from the read replica, §7.1).
type Engine struct {
	store *db.Store
	rooms *catalogue.Service
	loc   *time.Location
}

func NewEngine(store *db.Store, rooms *catalogue.Service, loc *time.Location) *Engine {
	return &Engine{store: store, rooms: rooms, loc: loc}
}

// SearchQuery is an FR6 availability query: a date, a local window, and filters.
type SearchQuery struct {
	Date     time.Time // the calendar day (institution-local)
	StartMin int       // window start, minutes from midnight
	EndMin   int       // window end, minutes from midnight
	Filter   catalogue.RoomFilter
}

// Result is one available room with its free sub-intervals within the window.
type Result struct {
	Room          catalogue.RoomDetail `json:"room"`
	FreeIntervals []Interval           `json:"free_intervals"`
}

// Search returns rooms free for the entire requested window (§7.1 algorithm).
func (e *Engine) Search(ctx context.Context, q SearchQuery) ([]Result, error) {
	start := time.Now()
	defer func() { metrics.ObserveAvailabilitySearch(time.Since(start).Seconds()) }()

	active := dbgen.RoomStatusACTIVE
	q.Filter.Status = &active // only ACTIVE rooms are bookable

	candidates, err := e.rooms.SearchRooms(ctx, q.Filter)
	if err != nil {
		return nil, err
	}
	window := Interval{Start: q.StartMin, End: q.EndMin}
	results := []Result{}
	for _, room := range candidates {
		occupied, err := e.occupiedFor(ctx, room.ID, q.Date)
		if err != nil {
			return nil, err
		}
		if FullyFree(window, occupied) {
			results = append(results, Result{Room: room, FreeIntervals: Subtract(window, occupied)})
		}
	}
	return results, nil
}

// occupiedFor gathers all occupancy intervals (in local minutes) for a room on a
// date: active-semester lectures for that weekday, approved bookings, maintenance.
func (e *Engine) occupiedFor(ctx context.Context, roomID uuid.UUID, date time.Time) ([]Interval, error) {
	day := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, e.loc)
	dayStart := day
	dayEnd := day.Add(24 * time.Hour)
	weekday := weekdayEnum[int(day.Weekday())]

	var occupied []Interval

	lectures, err := e.store.Read.ListRoomLecturesOnDay(ctx, dbgen.ListRoomLecturesOnDayParams{
		RoomID: roomID, Day: weekday, OnDate: pgconv.Date(day),
	})
	if err != nil {
		return nil, err
	}
	for _, lec := range lectures {
		sh, sm := pgconv.PgTimeToClock(lec.StartTime)
		eh, em := pgconv.PgTimeToClock(lec.EndTime)
		occupied = append(occupied, Interval{Start: sh*60 + sm, End: eh*60 + em})
	}

	bookings, err := e.store.Read.ListApprovedBookingsForRoomInRange(ctx, dbgen.ListApprovedBookingsForRoomInRangeParams{
		RoomID: roomID, DayStart: pgconv.TS(dayStart), DayEnd: pgconv.TS(dayEnd),
	})
	if err != nil {
		return nil, err
	}
	for _, b := range bookings {
		occupied = append(occupied, clampToDay(b.StartsAt.Time, b.EndsAt.Time, day, e.loc))
	}

	maint, err := e.store.Read.ListMaintenanceForRoomInRange(ctx, dbgen.ListMaintenanceForRoomInRangeParams{
		RoomID: roomID, DayStart: pgconv.TS(dayStart), DayEnd: pgconv.TS(dayEnd),
	})
	if err != nil {
		return nil, err
	}
	for _, m := range maint {
		occupied = append(occupied, clampToDay(m.StartsAt.Time, m.EndsAt.Time, day, e.loc))
	}

	return occupied, nil
}

// clampToDay projects a UTC instant range onto local minutes within [0,1440] of
// the given local day.
func clampToDay(start, end, day time.Time, loc *time.Location) Interval {
	ls := start.In(loc)
	le := end.In(loc)
	startMin := minutesInto(ls, day)
	endMin := minutesInto(le, day)
	if startMin < 0 {
		startMin = 0
	}
	if endMin > 1440 {
		endMin = 1440
	}
	return Interval{Start: startMin, End: endMin}
}

func minutesInto(t, day time.Time) int {
	return int(t.Sub(day).Minutes())
}
