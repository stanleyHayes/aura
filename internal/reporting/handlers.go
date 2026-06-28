package reporting

import (
	"encoding/csv"
	"fmt"
	"log/slog"
	"net/http"
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
	return r
}

func (h *Handler) parseFilter(r *http.Request) (Filter, error) {
	q := r.URL.Query()
	var f Filter
	var err error
	if v := q.Get("from"); v != "" {
		f.From, err = time.Parse("2006-01-02", v)
		if err != nil {
			return f, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "from", Message: "must be YYYY-MM-DD"})
		}
	} else {
		f.From = time.Now().AddDate(0, 0, -30)
	}
	if v := q.Get("to"); v != "" {
		f.To, err = time.Parse("2006-01-02", v)
		if err != nil {
			return f, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "to", Message: "must be YYYY-MM-DD"})
		}
	} else {
		f.To = time.Now().AddDate(0, 0, 1)
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
			ru.RoomCode, ru.RoomName, strconv.Itoa(ru.Capacity),
			fmt.Sprintf("%.1f", ru.LectureHours), fmt.Sprintf("%.1f", ru.BookedHours),
			fmt.Sprintf("%.1f", ru.AvailableHours), fmt.Sprintf("%.1f", ru.UtilisationPct),
		})
	}
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
