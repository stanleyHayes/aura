// Package reporting produces utilisation, booking and conflict reports (§7.9,
// FR12). Aggregations are parameterised SQL over the read path; small reports
// render synchronously as JSON, large exports are produced as CSV (xlsx/pdf via
// the worker + object storage is the Phase-2 path, ADR-0002/0007).
package reporting

import (
	"context"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db"
)

// dateLayout is the YYYY-MM-DD layout shared by overview range/series formatting.
const dateLayout = "2006-01-02"

type Service struct {
	store *db.Store
	// workingHoursPerDay is the denominator for utilisation% (institution working
	// window, default 12h ≈ 08:00–20:00). Configurable per deployment.
	workingHoursPerDay float64
}

func NewService(store *db.Store) *Service {
	return &Service{store: store, workingHoursPerDay: 12}
}

// Filter scopes every report (§7.9).
type Filter struct {
	From         time.Time
	To           time.Time
	BuildingID   *uuid.UUID
	DepartmentID *uuid.UUID
	RoomID       *uuid.UUID
}

func (f Filter) days() float64 {
	d := f.To.Sub(f.From).Hours() / 24
	if d < 1 {
		return 1
	}
	return d
}

// ── Utilisation ──────────────────────────────────────────────────────────────

type RoomUtilisation struct {
	RoomID         uuid.UUID `json:"room_id"`
	RoomCode       string    `json:"room_code"`
	RoomName       string    `json:"room_name"`
	Capacity       int       `json:"capacity"`
	LectureHours   float64   `json:"lecture_hours"`
	BookedHours    float64   `json:"booked_hours"`
	AvailableHours float64   `json:"available_hours"`
	UtilisationPct float64   `json:"utilisation_pct"`
}

type UtilisationReport struct {
	Rooms          []RoomUtilisation `json:"rooms"`
	TotalLecture   float64           `json:"total_lecture_hours"`
	TotalBooked    float64           `json:"total_booked_hours"`
	AverageUtilPct float64           `json:"average_utilisation_pct"`
}

// Utilisation computes per-room lecture vs booked hours over the range. Lecture
// hours expand the recurring active-semester timetable across the date range
// (each matching weekday inside the semester window counts once).
func (s *Service) Utilisation(ctx context.Context, f Filter) (UtilisationReport, error) {
	b := newBuilder()
	roomFilter := b.roomConds(f, "r")

	q := `
WITH booked AS (
  SELECT b.room_id, sum(extract(epoch from (b.ends_at - b.starts_at))/3600.0) AS hours
  FROM bookings b
  WHERE b.status = 'APPROVED' AND b.starts_at >= ` + b.add(f.From) + ` AND b.starts_at < ` + b.add(f.To) + `
  GROUP BY b.room_id
),
lectures AS (
  SELECT te.room_id,
         sum(occ.cnt * extract(epoch from (te.end_time - te.start_time))/3600.0) AS hours
  FROM timetable_events te
  JOIN semesters s ON s.id = te.semester_id AND s.status = 'ACTIVE'
  JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM generate_series(` + b.add(f.From) + `::date, (` + b.add(f.To) + `::date - 1), interval '1 day') AS d
    WHERE (ARRAY['SUN','MON','TUE','WED','THU','FRI','SAT'])[extract(dow from d)::int + 1] = te.day::text
      AND d::date BETWEEN s.start_date AND s.end_date
  ) occ ON true
  GROUP BY te.room_id
)
SELECT r.id, r.room_code, r.name, r.capacity,
       coalesce(lectures.hours, 0), coalesce(booked.hours, 0)
FROM rooms r
LEFT JOIN booked   ON booked.room_id = r.id
LEFT JOIN lectures ON lectures.room_id = r.id
` + roomFilter + `
ORDER BY r.room_code`

	rows, err := s.store.ReplicaPool.Query(ctx, q, b.args...)
	if err != nil {
		return UtilisationReport{}, err
	}
	defer rows.Close()

	rep := UtilisationReport{Rooms: []RoomUtilisation{}}
	totalUtil := 0.0
	available := s.workingHoursPerDay * f.days()
	for rows.Next() {
		var ru RoomUtilisation
		if err := rows.Scan(&ru.RoomID, &ru.RoomCode, &ru.RoomName, &ru.Capacity, &ru.LectureHours, &ru.BookedHours); err != nil {
			return UtilisationReport{}, err
		}
		used := ru.LectureHours + ru.BookedHours
		ru.AvailableHours = available - used
		if ru.AvailableHours < 0 {
			ru.AvailableHours = 0
		}
		if available > 0 {
			ru.UtilisationPct = round1(used / available * 100)
		}
		rep.Rooms = append(rep.Rooms, ru)
		rep.TotalLecture += ru.LectureHours
		rep.TotalBooked += ru.BookedHours
		totalUtil += ru.UtilisationPct
	}
	if n := len(rep.Rooms); n > 0 {
		rep.AverageUtilPct = round1(totalUtil / float64(n))
	}
	rep.TotalLecture = round1(rep.TotalLecture)
	rep.TotalBooked = round1(rep.TotalBooked)
	return rep, rows.Err()
}

// ── Bookings report ──────────────────────────────────────────────────────────

type BookingsReport struct {
	ByStatus      map[string]int64 `json:"by_status"`
	ByBuilding    map[string]int64 `json:"by_building"`
	ByDepartment  map[string]int64 `json:"by_department"`
	ApprovalRate  float64          `json:"approval_rate_pct"`
	RejectionRate float64          `json:"rejection_rate_pct"`
	TotalRequests int64            `json:"total_requests"`
}

func (s *Service) Bookings(ctx context.Context, f Filter) (BookingsReport, error) {
	rep := BookingsReport{ByStatus: map[string]int64{}, ByBuilding: map[string]int64{}, ByDepartment: map[string]int64{}}

	if err := s.groupCount(ctx, f, "b.status::text", rep.ByStatus); err != nil {
		return rep, err
	}
	if err := s.groupCount(ctx, f, "bld.code", rep.ByBuilding); err != nil {
		return rep, err
	}
	if err := s.groupCount(ctx, f, "coalesce(d.code, 'UNASSIGNED')", rep.ByDepartment); err != nil {
		return rep, err
	}

	var approved, rejected int64
	for st, n := range rep.ByStatus {
		rep.TotalRequests += n
		switch st {
		case "APPROVED":
			approved = n
		case "REJECTED":
			rejected = n
		}
	}
	if decided := approved + rejected; decided > 0 {
		rep.ApprovalRate = round1(float64(approved) / float64(decided) * 100)
		rep.RejectionRate = round1(float64(rejected) / float64(decided) * 100)
	}
	return rep, nil
}

func (s *Service) groupCount(ctx context.Context, f Filter, groupExpr string, out map[string]int64) error {
	b := newBuilder()
	q := `SELECT ` + groupExpr + `, count(*)
FROM bookings b
JOIN rooms r ON r.id = b.room_id
JOIN buildings bld ON bld.id = r.building_id
LEFT JOIN users u ON u.id = b.requested_by
LEFT JOIN departments d ON d.id = u.department_id
WHERE b.starts_at >= ` + b.add(f.From) + ` AND b.starts_at < ` + b.add(f.To) + b.roomCondsTail(f, "r") + `
GROUP BY 1`
	rows, err := s.store.ReplicaPool.Query(ctx, q, b.args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var n int64
		if err := rows.Scan(&key, &n); err != nil {
			return err
		}
		out[key] = n
	}
	return rows.Err()
}

// ── Conflict report ──────────────────────────────────────────────────────────

type ConflictReport struct {
	Rejected  int64 `json:"rejected_requests"`
	Cancelled int64 `json:"cancelled_bookings"`
	Expired   int64 `json:"expired_requests"`
}

func (s *Service) Conflicts(ctx context.Context, f Filter) (ConflictReport, error) {
	var rep ConflictReport
	statuses := map[string]*int64{"REJECTED": &rep.Rejected, "CANCELLED": &rep.Cancelled, "EXPIRED": &rep.Expired}
	for st, dst := range statuses {
		b := newBuilder()
		q := `SELECT count(*) FROM bookings b JOIN rooms r ON r.id = b.room_id
WHERE b.status = ` + b.add(st) + ` AND b.starts_at >= ` + b.add(f.From) + ` AND b.starts_at < ` + b.add(f.To) + b.roomCondsTail(f, "r")
		if err := s.store.ReplicaPool.QueryRow(ctx, q, b.args...).Scan(dst); err != nil {
			return rep, err
		}
	}
	return rep, nil
}

// ── Overview report (admin dashboard) ─────────────────────────────────────────

// OverviewReport powers the single admin overview dashboard. Every field is a
// pre-aggregated, parameterised read over the range (KPI counts that are
// "current-state" — active rooms/users, buildings, pending — deliberately ignore
// the range, matching the dashboard's live tiles).
type OverviewReport struct {
	Range           DateRange     `json:"range"`
	KPIs            OverviewKPIs  `json:"kpis"`
	StatusBreakdown []LabelCount  `json:"status_breakdown"`
	ByRoomType      []LabelCount  `json:"by_room_type"`
	ByBuilding      []LabelCount  `json:"by_building"`
	TopRooms        []TopRoom     `json:"top_rooms"`
	Series          []SeriesPoint `json:"series"`
	PeakHours       []HourCount   `json:"peak_hours"`
}

type DateRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type OverviewKPIs struct {
	TotalBookings     int64   `json:"total_bookings"`
	Pending           int64   `json:"pending"`
	Approved          int64   `json:"approved"`
	Rejected          int64   `json:"rejected"`
	Cancelled         int64   `json:"cancelled"`
	Expired           int64   `json:"expired"`
	ActiveRooms       int64   `json:"active_rooms"`
	ActiveUsers       int64   `json:"active_users"`
	Buildings         int64   `json:"buildings"`
	AvgUtilisationPct float64 `json:"avg_utilisation_pct"`
	ApprovalRatePct   float64 `json:"approval_rate_pct"`
}

type LabelCount struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type TopRoom struct {
	RoomCode       string  `json:"room_code"`
	RoomName       string  `json:"room_name"`
	UtilisationPct float64 `json:"utilisation_pct"`
	BookedHours    float64 `json:"booked_hours"`
}

type SeriesPoint struct {
	Date      string `json:"date"`
	Submitted int64  `json:"submitted"`
	Approved  int64  `json:"approved"`
}

type HourCount struct {
	Hour  int   `json:"hour"`
	Count int64 `json:"count"`
}

// bookingStatuses is the fixed set surfaced in status_breakdown / KPIs, in a
// stable order. Zero-count statuses are still emitted so the dashboard's bars
// are stable.
var bookingStatuses = []string{"PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"}

// Overview assembles the admin dashboard report. The date range scopes the
// in-range counts; current-state counts (active rooms/users, buildings, pending)
// ignore the range by design.
func (s *Service) Overview(ctx context.Context, f Filter) (OverviewReport, error) {
	rep := OverviewReport{
		Range:           DateRange{From: f.From.Format(dateLayout), To: f.To.Format(dateLayout)},
		StatusBreakdown: []LabelCount{},
		ByRoomType:      []LabelCount{},
		ByBuilding:      []LabelCount{},
		TopRooms:        []TopRoom{},
		Series:          []SeriesPoint{},
		PeakHours:       []HourCount{},
	}

	// Make the window inclusive of the "to" day. f.To is an exclusive midnight,
	// so without this, bookings created/scheduled on the final day (e.g. today)
	// are dropped and the dashboard reads empty. rep.Range above keeps the
	// caller's original dates.
	f.To = f.To.AddDate(0, 0, 1)

	// status_breakdown (by request date, in range) — also feeds the per-status KPIs.
	byStatus := map[string]int64{}
	if err := s.overviewGroupCount(ctx, f, "b.status::text", byStatus); err != nil {
		return rep, err
	}
	var approved, rejected int64
	for _, st := range bookingStatuses {
		n := byStatus[st]
		rep.StatusBreakdown = append(rep.StatusBreakdown, LabelCount{Label: st, Count: n})
		switch st {
		case "APPROVED":
			approved = n
		case "REJECTED":
			rejected = n
		case "CANCELLED":
			rep.KPIs.Cancelled = n
		case "EXPIRED":
			rep.KPIs.Expired = n
		}
		rep.KPIs.TotalBookings += n
	}
	rep.KPIs.Approved = approved
	rep.KPIs.Rejected = rejected
	if decided := approved + rejected; decided > 0 {
		rep.KPIs.ApprovalRatePct = round1(float64(approved) / float64(decided) * 100)
	}

	// by_room_type / by_building (in range), ordered count desc then label.
	byType := map[string]int64{}
	if err := s.overviewGroupCount(ctx, f, "r.room_type::text", byType); err != nil {
		return rep, err
	}
	rep.ByRoomType = sortedLabelCounts(byType)
	byBld := map[string]int64{}
	if err := s.overviewGroupCount(ctx, f, "bld.code", byBld); err != nil {
		return rep, err
	}
	rep.ByBuilding = sortedLabelCounts(byBld)

	// pending — current state, ignores range.
	if err := s.store.ReplicaPool.QueryRow(ctx,
		`SELECT count(*) FROM bookings WHERE status = 'PENDING'`).Scan(&rep.KPIs.Pending); err != nil {
		return rep, err
	}
	// active_rooms / active_users / buildings — current state.
	if err := s.store.ReplicaPool.QueryRow(ctx,
		`SELECT count(*) FROM rooms WHERE status = 'ACTIVE'`).Scan(&rep.KPIs.ActiveRooms); err != nil {
		return rep, err
	}
	if err := s.store.ReplicaPool.QueryRow(ctx,
		`SELECT count(*) FROM users WHERE status = 'ACTIVE'`).Scan(&rep.KPIs.ActiveUsers); err != nil {
		return rep, err
	}
	if err := s.store.ReplicaPool.QueryRow(ctx,
		`SELECT count(*) FROM buildings`).Scan(&rep.KPIs.Buildings); err != nil {
		return rep, err
	}

	// Utilisation (reused) → avg + top rooms.
	util, err := s.Utilisation(ctx, f)
	if err != nil {
		return rep, err
	}
	rep.KPIs.AvgUtilisationPct = util.AverageUtilPct
	rep.TopRooms = topRooms(util.Rooms, 8)

	// series + peak hours.
	if err := s.overviewSeries(ctx, f, &rep.Series); err != nil {
		return rep, err
	}
	if err := s.overviewPeakHours(ctx, f, &rep.PeakHours); err != nil {
		return rep, err
	}
	return rep, nil
}

// overviewGroupCount runs a range-scoped GROUP BY over the canonical bookings
// shape. Mirrors groupCount but is not building/room filtered: the overview is a
// global dashboard scoped only by the date range.
func (s *Service) overviewGroupCount(ctx context.Context, f Filter, groupExpr string, out map[string]int64) error {
	b := newBuilder()
	q := `SELECT ` + groupExpr + `, count(*)
FROM bookings b
JOIN rooms r ON r.id = b.room_id
JOIN buildings bld ON bld.id = r.building_id
WHERE b.created_at >= ` + b.add(f.From) + ` AND b.created_at < ` + b.add(f.To) + `
GROUP BY 1`
	rows, err := s.store.ReplicaPool.Query(ctx, q, b.args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var n int64
		if err := rows.Scan(&key, &n); err != nil {
			return err
		}
		out[key] = n
	}
	return rows.Err()
}

// overviewSeries returns one point per calendar day in [from, to). A
// generate_series spine LEFT JOINs the per-day booking counts so empty days
// appear as zero. Days are bucketed by created_at in the institution timezone;
// "approved" counts rows created that day whose status is APPROVED.
func (s *Service) overviewSeries(ctx context.Context, f Filter, out *[]SeriesPoint) error {
	b := newBuilder()
	q := `WITH tz AS (SELECT coalesce(current_setting('app.institution_tz', true), 'Africa/Accra') AS name)
SELECT d::date,
       coalesce(s.submitted, 0),
       coalesce(s.approved, 0)
FROM generate_series(` + b.add(f.From) + `::date, (` + b.add(f.To) + `::date - 1), interval '1 day') AS d
LEFT JOIN (
  SELECT (b.created_at AT TIME ZONE (SELECT name FROM tz))::date AS day,
         count(*) AS submitted,
         count(*) FILTER (WHERE b.status = 'APPROVED') AS approved
  FROM bookings b
  WHERE (b.created_at AT TIME ZONE (SELECT name FROM tz))::date >= ` + b.add(f.From) + `::date
    AND (b.created_at AT TIME ZONE (SELECT name FROM tz))::date < ` + b.add(f.To) + `::date
  GROUP BY 1
) s ON s.day = d::date
ORDER BY d`
	rows, err := s.store.ReplicaPool.Query(ctx, q, b.args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var p SeriesPoint
		var day time.Time
		if err := rows.Scan(&day, &p.Submitted, &p.Approved); err != nil {
			return err
		}
		p.Date = day.Format(dateLayout)
		*out = append(*out, p)
	}
	return rows.Err()
}

// overviewPeakHours buckets in-range bookings by local hour-of-day (0..23) in the
// institution timezone. A generate_series(0,23) spine ensures every hour appears
// even with no bookings.
func (s *Service) overviewPeakHours(ctx context.Context, f Filter, out *[]HourCount) error {
	b := newBuilder()
	q := `WITH tz AS (SELECT coalesce(current_setting('app.institution_tz', true), 'Africa/Accra') AS name)
SELECT h, coalesce(c.cnt, 0)
FROM generate_series(0, 23) AS h
LEFT JOIN (
  SELECT extract(hour FROM (b.starts_at AT TIME ZONE (SELECT name FROM tz)))::int AS hr,
         count(*) AS cnt
  FROM bookings b
  WHERE b.starts_at >= ` + b.add(f.From) + ` AND b.starts_at < ` + b.add(f.To) + `
  GROUP BY 1
) c ON c.hr = h
ORDER BY h`
	rows, err := s.store.ReplicaPool.Query(ctx, q, b.args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var hc HourCount
		if err := rows.Scan(&hc.Hour, &hc.Count); err != nil {
			return err
		}
		*out = append(*out, hc)
	}
	return rows.Err()
}

// sortedLabelCounts renders a label→count map as a slice ordered by count desc,
// then label asc for a stable presentation.
func sortedLabelCounts(m map[string]int64) []LabelCount {
	out := make([]LabelCount, 0, len(m))
	for k, v := range m {
		out = append(out, LabelCount{Label: k, Count: v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Label < out[j].Label
	})
	return out
}

// topRooms returns the n rooms with the highest utilisation_pct (desc), tie-broken
// by room_code for stability.
func topRooms(rooms []RoomUtilisation, n int) []TopRoom {
	sorted := make([]RoomUtilisation, len(rooms))
	copy(sorted, rooms)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].UtilisationPct != sorted[j].UtilisationPct {
			return sorted[i].UtilisationPct > sorted[j].UtilisationPct
		}
		return sorted[i].RoomCode < sorted[j].RoomCode
	})
	if len(sorted) > n {
		sorted = sorted[:n]
	}
	out := make([]TopRoom, 0, len(sorted))
	for _, r := range sorted {
		out = append(out, TopRoom{
			RoomCode:       r.RoomCode,
			RoomName:       r.RoomName,
			UtilisationPct: r.UtilisationPct,
			BookedHours:    round1(r.BookedHours),
		})
	}
	return out
}

// ── parameter builder (placeholders only — never interpolated values) ─────────

type builder struct {
	args []any
}

func newBuilder() *builder { return &builder{} }

func (b *builder) add(v any) string {
	b.args = append(b.args, v)
	return "$" + strconv.Itoa(len(b.args))
}

func (b *builder) roomConds(f Filter, alias string) string {
	tail := b.roomCondsTail(f, alias)
	if tail == "" {
		return ""
	}
	return "WHERE " + strings.TrimPrefix(tail, " AND ")
}

func (b *builder) roomCondsTail(f Filter, alias string) string {
	var sb strings.Builder
	if f.RoomID != nil {
		sb.WriteString(" AND " + alias + ".id = " + b.add(*f.RoomID))
	}
	if f.BuildingID != nil {
		sb.WriteString(" AND " + alias + ".building_id = " + b.add(*f.BuildingID))
	}
	return sb.String()
}

func round1(v float64) float64 { return float64(int64(v*10+0.5)) / 10 }
