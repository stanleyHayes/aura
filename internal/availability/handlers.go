package availability

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/catalogue"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/httpx"
)

type Handler struct {
	engine *Engine
	log    *slog.Logger
}

func NewHandler(engine *Engine, log *slog.Logger) *Handler {
	return &Handler{engine: engine, log: log}
}

// Mount registers /availability/search and /calendar on the parent (auth-only; §8.3).
func (h *Handler) Mount(r chi.Router) {
	r.Get("/availability/search", h.search)
	r.Get("/calendar", h.calendar)
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	date, err := time.Parse("2006-01-02", q.Get("date"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "date", Message: "must be YYYY-MM-DD"}))
		return
	}
	startMin, err := parseHHMM(q.Get("start"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "start", Message: "must be HH:MM"}))
		return
	}
	endMin, err := parseHHMM(q.Get("end"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end", Message: "must be HH:MM"}))
		return
	}
	if endMin <= startMin {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end", Message: "must be after start"}))
		return
	}

	results, err := h.engine.Search(r.Context(), SearchQuery{
		Date: date, StartMin: startMin, EndMin: endMin, Filter: catalogue.ParseRoomFilter(r),
	})
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": results})
}

func (h *Handler) calendar(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	view := q.Get("view")
	if view == "" {
		view = "day"
	}
	date, err := time.Parse("2006-01-02", q.Get("date"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "date", Message: "must be YYYY-MM-DD"}))
		return
	}
	cq := CalendarQuery{View: view, Date: date}
	if v := q.Get("room_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			cq.RoomID = &id
		}
	}
	if v := q.Get("building_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			cq.BuildingID = &id
		}
	}
	if cq.RoomID == nil && cq.BuildingID == nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("room_id or building_id is required"))
		return
	}

	blocks, err := h.engine.Calendar(r.Context(), cq)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"view": view, "data": blocks})
}

func parseHHMM(s string) (int, error) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, err
	}
	return t.Hour()*60 + t.Minute(), nil
}
