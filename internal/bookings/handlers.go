package bookings

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/audit"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/pgconv"
	"github.com/aura/cbs/internal/platform/rbac"
)

type Handler struct {
	svc   *Service
	store *db.Store
	audit *audit.Recorder
	log   *slog.Logger
}

func NewHandler(svc *Service, store *db.Store, rec *audit.Recorder, log *slog.Logger) *Handler {
	return &Handler{svc: svc, store: store, audit: rec, log: log}
}

// Routes mounts /bookings/* (§8.3). Auth is applied by the parent group.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.With(httpx.RequirePermission(rbac.BookingCreate, h.log)).Post("/", h.create)
	r.Get("/", h.list)
	r.With(httpx.RequirePermission(rbac.BookingReadAny, h.log)).Get("/metrics", h.metrics)
	r.Get("/{id}", h.get)
	r.With(httpx.RequirePermission(rbac.BookingApprove, h.log)).Post("/{id}/approve", h.approve)
	r.With(httpx.RequirePermission(rbac.BookingApprove, h.log)).Post("/{id}/reject", h.reject)
	r.Post("/{id}/cancel", h.cancel)
	r.With(httpx.RequirePermission(rbac.BookingOverride, h.log)).Post("/{id}/override", h.override)
	return r
}

// MaintenanceRoutes mounts /maintenance-windows/* (SUPER_ADMIN; §8.3).
func (h *Handler) MaintenanceRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(httpx.RequirePermission(rbac.MaintenanceManage, h.log))
	r.Get("/", h.listMaintenance)
	r.Post("/", h.createMaintenance)
	r.Delete("/{id}", h.deleteMaintenance)
	return r
}

// ── Bookings ─────────────────────────────────────────────────────────────────

type createReq struct {
	RoomID        string `json:"room_id"`
	Purpose       string `json:"purpose"`
	AttendeeCount int    `json:"attendee_count"`
	StartsAt      string `json:"starts_at"`
	EndsAt        string `json:"ends_at"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("could not read body"))
		return
	}

	// Idempotency (§8.1): replay the stored response for a repeated key.
	idemKey := r.Header.Get("Idempotency-Key")
	reqHash := sha256Hex(body)
	if idemKey != "" {
		if existing, err := h.store.GetIdempotencyKey(r.Context(), dbgen.GetIdempotencyKeyParams{UserID: id.UserID, IdemKey: idemKey}); err == nil {
			if existing.RequestHash != reqHash {
				httpx.Error(w, r, h.log, apperr.ErrIdempotencyMismatch)
				return
			}
			httpx.JSON(w, int(existing.StatusCode), json.RawMessage(existing.ResponseBody))
			return
		}
	}

	var req createReq
	if err := json.Unmarshal(body, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("invalid JSON body"))
		return
	}
	roomID, err := uuid.Parse(req.RoomID)
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "room_id", Message: "must be a UUID"}))
		return
	}
	startsAt, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "starts_at", Message: "must be RFC3339"}))
		return
	}
	endsAt, err := time.Parse(time.RFC3339, req.EndsAt)
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "ends_at", Message: "must be RFC3339"}))
		return
	}

	result, err := h.svc.Create(r.Context(), CreateInput{
		RoomID: roomID, RequestedBy: id.UserID, Purpose: req.Purpose,
		AttendeeCount: req.AttendeeCount, StartsAt: startsAt, EndsAt: endsAt,
	})
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	h.record(r, "CREATE", "booking", result.Booking.ID, result.Booking)
	if idemKey != "" {
		respBody, _ := json.Marshal(result)
		_, _ = h.store.PutIdempotencyKey(r.Context(), dbgen.PutIdempotencyKeyParams{
			UserID: id.UserID, IdemKey: idemKey, RequestHash: reqHash,
			StatusCode: http.StatusCreated, ResponseBody: respBody,
			ExpiresAt: pgconv.TS(time.Now().Add(24 * time.Hour)),
		})
	}
	httpx.Created(w, result)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	scope := r.URL.Query().Get("scope")
	p := dbgen.ListBookingsParams{Cursor: httpx.Cursor(r), Lim: int32(httpx.Limit(r))}

	switch scope {
	case "", "mine":
		p.RequesterID = &id.UserID
	case "pending", "all":
		if !rbac.Can(id.Role, rbac.BookingReadAny) {
			httpx.Error(w, r, h.log, apperr.ErrForbidden)
			return
		}
		if scope == "pending" {
			st := dbgen.BookingStatusPENDING
			p.Status = &st
		}
	default:
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("scope must be mine|pending|all"))
		return
	}

	if v := r.URL.Query().Get("room_id"); v != "" {
		if rid, err := uuid.Parse(v); err == nil {
			p.RoomID = &rid
		}
	}
	if v := r.URL.Query().Get("status"); v != "" && p.Status == nil {
		st := dbgen.BookingStatus(v)
		p.Status = &st
	}

	// The pending scope (the approvals queue) returns approvability-enriched rows
	// — each with nested room/requester and the §11/FR8 blockers explaining why a
	// request can or cannot be approved. The {data, next_cursor} envelope is
	// identical to the plain list, so the web reads page.data unchanged.
	if scope == "pending" {
		items, err := h.svc.PendingApprovability(r.Context(), dbgen.ListPendingForApprovalParams{
			RoomID: p.RoomID, Cursor: p.Cursor, Lim: p.Lim,
		})
		if err != nil {
			httpx.Error(w, r, h.log, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.NewPage(items, int(p.Lim), func(a Approvability) uuid.UUID { return a.Booking.ID }))
		return
	}

	views, err := h.svc.List(r.Context(), p)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.NewPage(views, int(p.Lim), func(v BookingView) uuid.UUID { return v.ID }))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	bookingID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	b, err := h.svc.Get(r.Context(), bookingID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if b.RequestedBy != id.UserID && !rbac.Can(id.Role, rbac.BookingReadAny) {
		httpx.Error(w, r, h.log, apperr.ErrForbidden) // IDOR prevention (§9.3)
		return
	}
	httpx.JSON(w, http.StatusOK, viewFromGet(b))
}

func (h *Handler) metrics(w http.ResponseWriter, r *http.Request) {
	rows, err := h.store.ReplicaPool.Query(r.Context(),
		`SELECT status::text, count(*) FROM bookings
		 WHERE status IN ('PENDING', 'APPROVED', 'REJECTED')
		 GROUP BY status`)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	defer rows.Close()

	out := map[string]int64{"pending": 0, "approved": 0, "rejected": 0, "total": 0}
	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			httpx.Error(w, r, h.log, err)
			return
		}
		switch status {
		case "PENDING":
			out["pending"] = count
		case "APPROVED":
			out["approved"] = count
		case "REJECTED":
			out["rejected"] = count
		}
		out["total"] += count
	}
	if err := rows.Err(); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) approve(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	bookingID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	note := optionalNote(r)
	view, err := h.svc.Approve(r.Context(), bookingID, id.UserID, note)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "APPROVE", "booking", view.ID, view)
	httpx.JSON(w, http.StatusOK, view)
}

func (h *Handler) reject(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	bookingID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	_ = httpx.DecodeJSON(r, &body)
	if body.Note == "" {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "note", Message: "a rejection note is required"}))
		return
	}
	view, err := h.svc.Reject(r.Context(), bookingID, id.UserID, body.Note)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "REJECT", "booking", view.ID, view)
	httpx.JSON(w, http.StatusOK, view)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	bookingID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	b, err := h.svc.Get(r.Context(), bookingID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	// Owner or a booking officer may cancel (§3.1, §9.3).
	if b.RequestedBy != id.UserID && !rbac.Can(id.Role, rbac.BookingApprove) {
		httpx.Error(w, r, h.log, apperr.ErrForbidden)
		return
	}
	var body struct {
		Note *string `json:"note"`
	}
	if r.ContentLength > 0 {
		if err := httpx.DecodeJSON(r, &body); err != nil {
			httpx.Error(w, r, h.log, err)
			return
		}
	}
	view, err := h.svc.Cancel(r.Context(), bookingID, id.UserID, body.Note)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CANCEL", "booking", view.ID, view)
	httpx.JSON(w, http.StatusOK, view)
}

func (h *Handler) override(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	bookingID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var body struct {
		Note              string `json:"note"`
		CancelConflicting bool   `json:"cancel_conflicting"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var note *string
	if body.Note != "" {
		note = &body.Note
	}
	approved, cancelled, err := h.svc.Override(r.Context(), bookingID, id.UserID, note, body.CancelConflicting)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "OVERRIDE", "booking", approved.ID, map[string]any{"approved": approved, "cancelled": cancelled})
	httpx.JSON(w, http.StatusOK, map[string]any{"approved": approved, "cancelled": cancelled})
}

// ── Maintenance ──────────────────────────────────────────────────────────────

type maintenanceReq struct {
	RoomID   string `json:"room_id"`
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at"`
	Reason   string `json:"reason"`
}

func (h *Handler) listMaintenance(w http.ResponseWriter, r *http.Request) {
	var roomID *uuid.UUID
	if v := r.URL.Query().Get("room_id"); v != "" {
		if rid, err := uuid.Parse(v); err == nil {
			roomID = &rid
		}
	}
	views, err := h.svc.ListMaintenance(r.Context(), roomID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": views})
}

func (h *Handler) createMaintenance(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	var req maintenanceReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	roomID, err := uuid.Parse(req.RoomID)
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "room_id", Message: "must be a UUID"}))
		return
	}
	startsAt, err1 := time.Parse(time.RFC3339, req.StartsAt)
	endsAt, err2 := time.Parse(time.RFC3339, req.EndsAt)
	if err1 != nil || err2 != nil {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("starts_at and ends_at must be RFC3339"))
		return
	}
	view, err := h.svc.CreateMaintenance(r.Context(), roomID, startsAt, endsAt, req.Reason, id.UserID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "maintenance_window", view.ID, view)
	httpx.Created(w, view)
}

func (h *Handler) deleteMaintenance(w http.ResponseWriter, r *http.Request) {
	mID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteMaintenance(r.Context(), mID); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "DELETE", "maintenance_window", mID, nil)
	httpx.NoContent(w)
}

// ── helpers ──────────────────────────────────────────────────────────────────

func optionalNote(r *http.Request) *string {
	var body struct {
		Note string `json:"note"`
	}
	_ = httpx.DecodeJSON(r, &body)
	if body.Note == "" {
		return nil
	}
	return &body.Note
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func (h *Handler) record(r *http.Request, action, entity string, id uuid.UUID, after any) {
	actor := auth.MustIdentity(r.Context()).UserID
	eid := id
	h.audit.Record(r.Context(), audit.Entry{
		ActorID: &actor, Action: action, EntityType: entity, EntityID: &eid, After: after,
		IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r),
	})
}
