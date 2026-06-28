// Package reporting produces utilisation, booking and conflict reports (§7.9,
// FR12). Aggregations are parameterised SQL over the read path; small reports
// render synchronously as JSON, large exports are produced as CSV (xlsx/pdf via
// the worker + object storage is the Phase-2 path, ADR-0002/0007).
package reporting

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db"
)

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
