package audit

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/rbac"
)

type Lister interface {
	ListAuditLogs(ctx context.Context, arg dbgen.ListAuditLogsParams) ([]dbgen.ListAuditLogsRow, error)
}

type Handler struct {
	q   Lister
	log *slog.Logger
}

func NewHandler(q Lister, log *slog.Logger) *Handler {
	return &Handler{q: q, log: log}
}

// Routes mounts /audit-logs/* (SYSTEM_ADMIN only; §8.3, §9.4).
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(httpx.RequirePermission(rbac.AuditView, h.log))
	r.Get("/", h.list)
	return r
}

type auditLogView struct {
	ID         uuid.UUID       `json:"id"`
	ActorID    *uuid.UUID      `json:"actor_id,omitempty"`
	ActorName  *string         `json:"actor_name,omitempty"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   *uuid.UUID      `json:"entity_id,omitempty"`
	Changes    json.RawMessage `json:"changes,omitempty"`
	IPAddress  *string         `json:"ip_address,omitempty"`
	CreatedAt  string          `json:"created_at"`
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limit := httpx.Limit(r)
	params := dbgen.ListAuditLogsParams{
		ActorID:    queryUUID(r, "actor_id"),
		EntityID:   queryUUID(r, "entity_id"),
		EntityType: queryString(r, "entity_type"),
		Action:     queryString(r, "action"),
		Cursor:     httpx.Cursor(r),
		Lim:        int32(limit),
	}
	if invalid := firstInvalidUUID(r, "actor_id", "entity_id"); invalid != "" {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{
			Field:   invalid,
			Message: "must be a UUID",
		}))
		return
	}

	rows, err := h.q.ListAuditLogs(r.Context(), params)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]auditLogView, len(rows))
	for i, row := range rows {
		views[i] = toAuditLogView(row)
	}
	httpx.JSON(w, http.StatusOK, httpx.NewPage(views, limit, func(v auditLogView) uuid.UUID { return v.ID }))
}

func toAuditLogView(row dbgen.ListAuditLogsRow) auditLogView {
	var changes json.RawMessage
	if len(row.Changes) > 0 {
		changes = append(json.RawMessage(nil), row.Changes...)
	}
	return auditLogView{
		ID:         row.ID,
		ActorID:    row.ActorID,
		ActorName:  row.ActorName,
		Action:     row.Action,
		EntityType: row.EntityType,
		EntityID:   row.EntityID,
		Changes:    changes,
		IPAddress:  row.IpAddress,
		CreatedAt:  row.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
	}
}

func queryString(r *http.Request, key string) *string {
	if v := r.URL.Query().Get(key); v != "" {
		return &v
	}
	return nil
}

func queryUUID(r *http.Request, key string) *uuid.UUID {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil
	}
	return &id
}

func firstInvalidUUID(r *http.Request, keys ...string) string {
	for _, key := range keys {
		v := r.URL.Query().Get(key)
		if v == "" {
			continue
		}
		if _, err := uuid.Parse(v); err != nil {
			return key
		}
	}
	return ""
}
