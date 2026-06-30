package notifications

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
)

type Handler struct {
	svc    *Service
	broker *Broker
	log    *slog.Logger
}

func NewHandler(svc *Service, broker *Broker, log *slog.Logger) *Handler {
	return &Handler{svc: svc, broker: broker, log: log}
}

// Routes mounts /notifications/* and /devices (§8.3). Auth applied by parent.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Get("/unread-count", h.unreadCount)
	r.Post("/{id}/read", h.markRead)
	r.Post("/read-all", h.markAllRead)
	r.Get("/stream", h.stream)
	return r
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	p := dbgen.ListNotificationsParams{
		UserID: id.UserID, Cursor: httpx.Cursor(r), Lim: int32(httpx.Limit(r)),
		UnreadOnly: r.URL.Query().Get("unread") == "true",
	}
	ns, err := h.svc.List(r.Context(), p)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]notificationView, len(ns))
	for i, n := range ns {
		views[i] = toView(n)
	}
	httpx.JSON(w, http.StatusOK, httpx.NewPage(views, int(p.Lim), func(v notificationView) uuid.UUID { return v.ID }))
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	n, err := h.svc.Unread(r.Context(), id.UserID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int64{"unread": n})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	nID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.MarkRead(r.Context(), nID, id.UserID); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	if err := h.svc.MarkAllRead(r.Context(), id.UserID); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.NoContent(w)
}

// stream is the live in-app notification feed over Server-Sent Events (§7.8).
func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Error(w, r, h.log, apperr.ErrInternal.WithDetail("streaming unsupported"))
		return
	}
	ch, unsubscribe, err := h.broker.Subscribe(id.UserID)
	if err != nil {
		// Per-user stream cap reached (MED-6) — reject before writing SSE headers.
		httpx.Error(w, r, h.log, apperr.New(http.StatusTooManyRequests, "TOO_MANY_STREAMS", "Too many concurrent notification streams"))
		return
	}
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	keepalive := time.NewTicker(25 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			_, _ = fmt.Fprint(w, ": keep-alive\n\n")
			flusher.Flush()
		case n, ok := <-ch:
			if !ok {
				return
			}
			payload, _ := json.Marshal(toView(n))
			_, _ = fmt.Fprintf(w, "event: notification\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}

// DeviceRoutes mounts POST /devices for Expo push registration (§13).
func (h *Handler) DeviceRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.registerDevice)
	return r
}

type deviceReq struct {
	ExpoToken string  `json:"expo_token"`
	Platform  *string `json:"platform"`
}

func (h *Handler) registerDevice(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	var req deviceReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if req.ExpoToken == "" {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "expo_token", Message: "required"}))
		return
	}
	if err := h.svc.RegisterDevice(r.Context(), id.UserID, req.ExpoToken, req.Platform); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.NoContent(w)
}

// ── view ─────────────────────────────────────────────────────────────────────

type notificationView struct {
	ID        uuid.UUID  `json:"id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	ReadAt    *time.Time `json:"read_at"`
	CreatedAt *time.Time `json:"created_at"`
}

func toView(n dbgen.Notification) notificationView {
	v := notificationView{ID: n.ID, Type: n.Type, Title: n.Title, Body: n.Body}
	if n.ReadAt.Valid {
		t := n.ReadAt.Time
		v.ReadAt = &t
	}
	if n.CreatedAt.Valid {
		t := n.CreatedAt.Time
		v.CreatedAt = &t
	}
	return v
}
