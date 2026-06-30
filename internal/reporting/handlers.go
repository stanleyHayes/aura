package reporting

import (
	"encoding/csv"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/rbac"
)

type Handler struct {
	svc *Service
	log *slog.Logger
}

func NewHandler(svc *Service, log *slog.Logger) *Handler { return &Handler{svc: svc, log: log} }

// Routes mounts /reports/* (report.view; §8.3, §9.4).
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(httpx.RequirePermission(rbac.ReportView, h.log))
	r.Get("/utilisation", h.utilisation)
	r.Get("/bookings", h.bookings)
	r.Get("/conflicts", h.conflicts)
	r.Get("/overview", h.overview)
	return r
}

// maxReportRange bounds the reporting window (LOW-13): a report request may not
// span more than ~2 years, preventing an unbounded scan from query parameters.
const maxReportRange = 731 * 24 * time.Hour

// parseDateParam parses a YYYY-MM-DD query parameter, returning def when absent.
func parseDateParam(q url.Values, key string, def time.Time) (time.Time, error) {
	v := q.Get(key)
	if v == "" {
		return def, nil
	}
	t, err := time.Parse(dateLayout, v)
	if err != nil {
		return time.Time{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: key, Message: "must be YYYY-MM-DD"})
	}
	return t, nil
}

func (h *Handler) parseFilter(r *http.Request) (Filter, error) {
	q := r.URL.Query()
	var f Filter
	var err error
	if f.From, err = parseDateParam(q, "from", time.Now().AddDate(0, 0, -30)); err != nil {
		return f, err
	}
	if f.To, err = parseDateParam(q, "to", time.Now().AddDate(0, 0, 1)); err != nil {
		return f, err
	}
	if v := q.Get("building_id"); v != "" {
		if id, e := uuid.Parse(v); e == nil {
			f.BuildingID = &id
		}
	}
	if v := q.Get("room_id"); v != "" {
		if id, e := uuid.Parse(v); e == nil {
			f.RoomID = &id
		}
	}
	if v := q.Get("department_id"); v != "" {
		if id, e := uuid.Parse(v); e == nil {
			f.DepartmentID = &id
		}
	}
	// LOW-13: bound the range so a report cannot be forced to scan an unbounded
	// window. To must not precede From, and the span is capped at 731 days (~2yr).
	if f.To.Before(f.From) {
		return f, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "to", Message: "must be on or after 'from'"})
	}
	if f.To.Sub(f.From) > maxReportRange {
		return f, apperr.ErrUnprocessable.WithDetail("date range must not exceed %d days", int(maxReportRange.Hours()/24))
	}
	return f, nil
}

func (h *Handler) utilisation(w http.ResponseWriter, r *http.Request) {
	f, err := h.parseFilter(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	rep, err := h.svc.Utilisation(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if r.URL.Query().Get("format") == "csv" {
		h.utilisationCSV(w, rep)
		return
	}
	if format := r.URL.Query().Get("format"); format == "xlsx" || format == "pdf" {
		// Large binary exports are produced asynchronously by the worker and
		// delivered via a signed object-storage URL (§7.9). Not in MVP scope here.
		httpx.Error(w, r, h.log, apperr.ErrUnprocessable.WithDetail("format %q export is produced asynchronously; use the exports API (Phase 2)", format))
		return
	}
	httpx.JSON(w, http.StatusOK, rep)
}

func (h *Handler) utilisationCSV(w http.ResponseWriter, rep UtilisationReport) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=utilisation.csv")
	cw := csv.NewWriter(w)
	defer cw.Flush()
	_ = cw.Write([]string{"room_code", "room_name", "capacity", "lecture_hours", "booked_hours", "available_hours", "utilisation_pct"})
	for _, ru := range rep.Rooms {
		_ = cw.Write([]string{
			csvSafe(ru.RoomCode), csvSafe(ru.RoomName), strconv.Itoa(ru.Capacity),
			fmt.Sprintf("%.1f", ru.LectureHours), fmt.Sprintf("%.1f", ru.BookedHours),
			fmt.Sprintf("%.1f", ru.AvailableHours), fmt.Sprintf("%.1f", ru.UtilisationPct),
		})
	}
}

// csvSafe neutralises CSV/Excel formula injection (LOW-11). Spreadsheet apps
// interpret a cell beginning with =, +, -, @, TAB or CR as a formula; prefixing a
// single apostrophe forces it to be treated as literal text.
func csvSafe(s string) string {
	if s == "" {
		return s
	}
	switch s[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + s
	}
	return s
}

func (h *Handler) bookings(w http.ResponseWriter, r *http.Request) {
	f, err := h.parseFilter(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	rep, err := h.svc.Bookings(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rep)
}

// overview powers the admin overview dashboard. Unlike the other reports, it
// must not error when from/to are absent: it defaults to the last 30 days
// (to = today, from = today − 30d). It still honours the shared range bounds.
func (h *Handler) overview(w http.ResponseWriter, r *http.Request) {
	f, err := h.parseOverviewFilter(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	rep, err := h.svc.Overview(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rep)
}

// parseOverviewFilter mirrors parseFilter but defaults the range to the last 30
// days when from/to are missing (to = today, from = today − 30d).
func (h *Handler) parseOverviewFilter(r *http.Request) (Filter, error) {
	q := r.URL.Query()
	var f Filter
	var err error
	today := time.Now().Truncate(24 * time.Hour)
	if f.To, err = parseDateParam(q, "to", today); err != nil {
		return f, err
	}
	if f.From, err = parseDateParam(q, "from", f.To.AddDate(0, 0, -30)); err != nil {
		return f, err
	}
	if f.To.Before(f.From) {
		return f, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "to", Message: "must be on or after 'from'"})
	}
	if f.To.Sub(f.From) > maxReportRange {
		return f, apperr.ErrUnprocessable.WithDetail("date range must not exceed %d days", int(maxReportRange.Hours()/24))
	}
	return f, nil
}

func (h *Handler) conflicts(w http.ResponseWriter, r *http.Request) {
	f, err := h.parseFilter(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	rep, err := h.svc.Conflicts(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rep)
}
