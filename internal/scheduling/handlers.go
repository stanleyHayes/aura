package scheduling

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/audit"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/rbac"
)

const maxUploadBytes = 10 << 20 // 10 MiB cap on timetable uploads (§14 file uploads)

type Handler struct {
	svc   *Service
	audit *audit.Recorder
	log   *slog.Logger
}

func NewHandler(svc *Service, rec *audit.Recorder, log *slog.Logger) *Handler {
	return &Handler{svc: svc, audit: rec, log: log}
}

// SemesterRoutes mounts /semesters/* including the timetable import sub-route.
func (h *Handler) SemesterRoutes() chi.Router {
	r := chi.NewRouter()
	sem := httpx.RequirePermission(rbac.SemesterManage, h.log)
	tt := httpx.RequirePermission(rbac.TimetableManage, h.log)

	r.Get("/", h.listSemesters)
	r.Get("/{id}", h.getSemester)
	r.With(sem).Post("/", h.createSemester)
	r.With(sem).Patch("/{id}", h.updateSemester)
	r.With(sem).Delete("/{id}", h.deleteSemester)
	r.With(sem).Post("/{id}/activate", h.activateSemester)
	r.With(sem).Post("/{id}/archive", h.archiveSemester)
	r.With(tt).Post("/{id}/timetable/import", h.importTimetable)
	return r
}

// TimetableRoutes mounts /timetable/* (imports status, events CRUD).
func (h *Handler) TimetableRoutes() chi.Router {
	r := chi.NewRouter()
	tt := httpx.RequirePermission(rbac.TimetableManage, h.log)

	r.With(tt).Get("/imports/{id}", h.getImport)
	r.Get("/events", h.listEvents)
	r.With(tt).Post("/events", h.createEvent)
	r.With(tt).Patch("/events/{id}", h.updateEvent)
	r.With(tt).Delete("/events/{id}", h.deleteEvent)
	return r
}

// ── Semesters ────────────────────────────────────────────────────────────────

type semesterReq struct {
	Name      string `json:"name"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

func (r semesterReq) toInput() (SemesterInput, error) {
	sd, err := time.Parse("2006-01-02", r.StartDate)
	if err != nil {
		return SemesterInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "start_date", Message: "must be YYYY-MM-DD"})
	}
	ed, err := time.Parse("2006-01-02", r.EndDate)
	if err != nil {
		return SemesterInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end_date", Message: "must be YYYY-MM-DD"})
	}
	return SemesterInput{Name: r.Name, StartDate: sd, EndDate: ed}, nil
}

func (h *Handler) listSemesters(w http.ResponseWriter, r *http.Request) {
	ss, err := h.svc.ListSemesters(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]SemesterView, len(ss))
	for i, s := range ss {
		views[i] = ToSemesterView(s)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": views})
}

func (h *Handler) getSemester(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	s, err := h.svc.GetSemester(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, ToSemesterView(s))
}

func (h *Handler) createSemester(w http.ResponseWriter, r *http.Request) {
	var req semesterReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	in, err := req.toInput()
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	s, err := h.svc.CreateSemester(r.Context(), in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "semester", s.ID, ToSemesterView(s))
	httpx.Created(w, ToSemesterView(s))
}

func (h *Handler) updateSemester(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req semesterReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	in, err := req.toInput()
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	s, err := h.svc.UpdateSemester(r.Context(), id, in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "semester", s.ID, ToSemesterView(s))
	httpx.JSON(w, http.StatusOK, ToSemesterView(s))
}

func (h *Handler) deleteSemester(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteSemester(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "DELETE", "semester", id, nil)
	httpx.NoContent(w)
}

func (h *Handler) activateSemester(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.Activate, "ACTIVATE")
}
func (h *Handler) archiveSemester(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.Archive, "ARCHIVE")
}

func (h *Handler) transition(w http.ResponseWriter, r *http.Request, fn func(ctx context.Context, id uuid.UUID) (dbgen.Semester, error), action string) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	s, err := fn(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, action, "semester", s.ID, ToSemesterView(s))
	httpx.JSON(w, http.StatusOK, ToSemesterView(s))
}

// ── Timetable import ─────────────────────────────────────────────────────────

func (h *Handler) importTimetable(w http.ResponseWriter, r *http.Request) {
	semID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	// Hard-cap the request body to bound memory/disk use (§14 file uploads).
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+(1<<20))
	// #nosec G120 -- the body is hard-capped by MaxBytesReader above.
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("invalid multipart form: %v", err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("file is required"))
		return
	}
	defer func() { _ = file.Close() }()

	mode := ImportMode(strings.ToLower(r.FormValue("mode")))
	if mode != ModeReplace {
		mode = ModeAppend
	}

	name := strings.ToLower(header.Filename)
	var rows []RawRow
	var method dbgen.ImportMethod
	switch {
	case strings.HasSuffix(name, ".xlsx"):
		method = dbgen.ImportMethodEXCEL
		data := make([]byte, 0, header.Size)
		buf := make([]byte, 32*1024)
		for {
			n, rerr := file.Read(buf)
			data = append(data, buf[:n]...)
			if rerr != nil {
				break
			}
		}
		rows, err = ReadXLSX(data)
	case strings.HasSuffix(name, ".csv"):
		method = dbgen.ImportMethodCSV
		rows, err = ReadCSV(file)
	default:
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("unsupported file type; use .xlsx or .csv"))
		return
	}
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrUnprocessable.WithDetail("%v", err))
		return
	}

	uploader := auth.MustIdentity(r.Context()).UserID
	// Object storage is optional (ADR-0007); the original is processed in-memory.
	imp, err := h.svc.CreateImport(r.Context(), semID, uploader, method, nil)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	result, err := h.svc.ProcessImport(r.Context(), imp.ID, semID, rows, mode)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "IMPORT", "timetable", imp.ID, map[string]any{"imported": result.ImportedRows, "errors": result.ErrorRows})
	httpx.JSON(w, http.StatusAccepted, toImportView(result))
}

func (h *Handler) getImport(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	imp, err := h.svc.GetImport(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toImportView(imp))
}

func toImportView(i dbgen.TimetableImport) map[string]any {
	return map[string]any{
		"id":            i.ID,
		"semester_id":   i.SemesterID,
		"method":        i.Method,
		"status":        i.Status,
		"total_rows":    i.TotalRows,
		"imported_rows": i.ImportedRows,
		"error_rows":    i.ErrorRows,
		"error_report":  rawJSON(i.ErrorReport),
	}
}

// ── Timetable events ─────────────────────────────────────────────────────────

type eventReq struct {
	SemesterID   string `json:"semester_id"`
	RoomID       string `json:"room_id"`
	CourseCode   string `json:"course_code"`
	CourseTitle  string `json:"course_title"`
	LecturerName string `json:"lecturer_name"`
	Day          string `json:"day"`
	StartTime    string `json:"start_time"`
	EndTime      string `json:"end_time"`
}

func (req eventReq) toInput() (EventInput, error) {
	semID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		return EventInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "semester_id", Message: "must be a UUID"})
	}
	roomID, err := uuid.Parse(req.RoomID)
	if err != nil {
		return EventInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "room_id", Message: "must be a UUID"})
	}
	day, err := ParseDay(req.Day)
	if err != nil {
		return EventInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "day", Message: err.Error()})
	}
	sh, sm, err := ParseClock(req.StartTime)
	if err != nil {
		return EventInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "start_time", Message: err.Error()})
	}
	eh, em, err := ParseClock(req.EndTime)
	if err != nil {
		return EventInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "end_time", Message: err.Error()})
	}
	return EventInput{
		SemesterID: semID, RoomID: roomID, CourseCode: req.CourseCode, CourseTitle: req.CourseTitle,
		LecturerName: req.LecturerName, Day: day,
		StartHour: sh, StartMin: sm, EndHour: eh, EndMin: em,
	}, nil
}

func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request) {
	p := dbgen.ListTimetableEventsParams{}
	if v := r.URL.Query().Get("semester_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			p.SemesterID = &id
		}
	}
	if v := r.URL.Query().Get("room_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			p.RoomID = &id
		}
	}
	if v := r.URL.Query().Get("day"); v != "" {
		if d, err := ParseDay(v); err == nil {
			p.Day = &d
		}
	}
	evs, err := h.svc.ListEvents(r.Context(), p)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]EventView, len(evs))
	for i, e := range evs {
		views[i] = ToEventView(e)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": views})
}

func (h *Handler) createEvent(w http.ResponseWriter, r *http.Request) {
	var req eventReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	in, err := req.toInput()
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	ev, err := h.svc.CreateEvent(r.Context(), in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "timetable_event", ev.ID, ToEventView(ev))
	httpx.Created(w, ToEventView(ev))
}

func (h *Handler) updateEvent(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req eventReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	in, err := req.toInput()
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	ev, err := h.svc.UpdateEvent(r.Context(), id, in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "timetable_event", ev.ID, ToEventView(ev))
	httpx.JSON(w, http.StatusOK, ToEventView(ev))
}

func (h *Handler) deleteEvent(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteEvent(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "DELETE", "timetable_event", id, nil)
	httpx.NoContent(w)
}

// ── helpers ──────────────────────────────────────────────────────────────────

// rawJSON returns stored jsonb as a raw message so it is embedded, not re-escaped.
func rawJSON(b []byte) json.RawMessage {
	if len(b) == 0 {
		return json.RawMessage("null")
	}
	return json.RawMessage(b)
}

func (h *Handler) record(r *http.Request, action, entity string, id uuid.UUID, after any) {
	actor := auth.MustIdentity(r.Context()).UserID
	eid := id
	h.audit.Record(r.Context(), audit.Entry{
		ActorID: &actor, Action: action, EntityType: entity, EntityID: &eid, After: after,
		IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r),
	})
}
