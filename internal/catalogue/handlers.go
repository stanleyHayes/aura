package catalogue

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/audit"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/media"
	"github.com/aura/cbs/internal/platform/rbac"
)

type Handler struct {
	svc     *Service
	audit   *audit.Recorder
	log     *slog.Logger
	uploads *media.Cloudinary
}

func NewHandler(svc *Service, rec *audit.Recorder, log *slog.Logger, uploads *media.Cloudinary) *Handler {
	return &Handler{svc: svc, audit: rec, log: log, uploads: uploads}
}

// Mount registers buildings, equipment and rooms onto the parent router. Reads
// need auth; writes need room.manage (§8.3, §9.4).
func (h *Handler) Mount(r chi.Router) {
	manage := httpx.RequirePermission(rbac.RoomManage, h.log)

	r.Route("/buildings", func(r chi.Router) {
		r.Get("/", h.listBuildings)
		r.Get("/{id}", h.getBuilding)
		r.With(manage).Post("/", h.createBuilding)
		r.With(manage).Patch("/{id}", h.updateBuilding)
		r.With(manage).Post("/{id}/images", h.uploadBuildingImages)
		r.With(manage).Delete("/{id}", h.deleteBuilding)
	})
	r.Route("/equipment", func(r chi.Router) {
		r.Get("/", h.listEquipment)
		r.Get("/{id}", h.getEquipment)
		r.With(manage).Post("/", h.createEquipment)
		r.With(manage).Patch("/{id}", h.updateEquipment)
		r.With(manage).Post("/{id}/images", h.uploadEquipmentImages)
		r.With(manage).Delete("/{id}", h.deleteEquipment)
	})
	r.Route("/rooms", func(r chi.Router) {
		r.Get("/", h.listRooms)
		r.Get("/{id}", h.getRoom)
		r.With(manage).Post("/", h.createRoom)
		r.With(manage).Patch("/{id}", h.updateRoom)
		r.With(manage).Post("/{id}/images", h.uploadRoomImages)
		r.With(manage).Post("/{id}/deactivate", h.deactivateRoom)
		r.With(manage).Post("/{id}/activate", h.activateRoom)
		r.With(manage).Put("/{id}/equipment", h.setRoomEquipment)
	})
}

// PublicRoutes registers anonymous, read-only catalogue endpoints for the public
// room directory (§12.1). Only ACTIVE rooms are exposed and there are no write
// paths, so these are safe to serve unauthenticated. Mounted under
// /api/v1/public, outside the authn group.
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Get("/rooms", h.listPublicRooms)
	r.Get("/rooms/{id}", h.getPublicRoom)
}

func (h *Handler) listPublicRooms(w http.ResponseWriter, r *http.Request) {
	f := ParseRoomFilter(r)
	active := dbgen.RoomStatusACTIVE
	f.Status = &active // force ACTIVE regardless of the query string
	rooms, err := h.svc.SearchRooms(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.attachEquipment(r, rooms)
	httpx.JSON(w, http.StatusOK, httpx.NewPage(rooms, f.Limit, func(d RoomDetail) uuid.UUID { return d.ID }))
}

func (h *Handler) getPublicRoom(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.GetRoom(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if room.Status != dbgen.RoomStatusACTIVE {
		httpx.Error(w, r, h.log, apperr.ErrNotFound)
		return
	}
	eq, _ := h.svc.RoomEquipment(r.Context(), id)
	httpx.JSON(w, http.StatusOK, map[string]any{"room": room, "equipment": eq})
}

// ── Buildings ────────────────────────────────────────────────────────────────

type buildingReq struct {
	Code   string  `json:"code"`
	Name   string  `json:"name"`
	Campus *string `json:"campus"`
}

func (h *Handler) listBuildings(w http.ResponseWriter, r *http.Request) {
	bs, err := h.svc.ListBuildings(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": bs})
}

func (h *Handler) getBuilding(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	b, err := h.svc.GetBuilding(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, b)
}

func (h *Handler) createBuilding(w http.ResponseWriter, r *http.Request) {
	var req buildingReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	b, err := h.svc.CreateBuilding(r.Context(), req.Code, req.Name, req.Campus)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "building", b.ID, b)
	httpx.Created(w, b)
}

func (h *Handler) updateBuilding(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req buildingReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	b, err := h.svc.UpdateBuilding(r.Context(), id, req.Code, req.Name, req.Campus)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "building", b.ID, b)
	httpx.JSON(w, http.StatusOK, b)
}

func (h *Handler) deleteBuilding(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteBuilding(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "DELETE", "building", id, nil)
	httpx.NoContent(w)
}

// ── Equipment ────────────────────────────────────────────────────────────────

type equipmentReq struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

func (h *Handler) listEquipment(w http.ResponseWriter, r *http.Request) {
	es, err := h.svc.ListEquipment(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": es})
}

func (h *Handler) getEquipment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	e, err := h.svc.GetEquipment(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, e)
}

func (h *Handler) createEquipment(w http.ResponseWriter, r *http.Request) {
	var req equipmentReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	e, err := h.svc.CreateEquipment(r.Context(), req.Code, req.Name)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "equipment", e.ID, e)
	httpx.Created(w, e)
}

func (h *Handler) updateEquipment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req equipmentReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	e, err := h.svc.UpdateEquipment(r.Context(), id, req.Code, req.Name)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "equipment", e.ID, e)
	httpx.JSON(w, http.StatusOK, e)
}

func (h *Handler) deleteEquipment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteEquipment(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "DELETE", "equipment", id, nil)
	httpx.NoContent(w)
}

// ── Rooms ────────────────────────────────────────────────────────────────────

type roomReq struct {
	RoomCode   string `json:"room_code"`
	Name       string `json:"name"`
	BuildingID string `json:"building_id"`
	Capacity   int    `json:"capacity"`
	RoomType   string `json:"room_type"`
	Status     string `json:"status"`
}

func (h *Handler) listRooms(w http.ResponseWriter, r *http.Request) {
	f := ParseRoomFilter(r)
	rooms, err := h.svc.SearchRooms(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.attachEquipment(r, rooms)
	httpx.JSON(w, http.StatusOK, httpx.NewPage(rooms, f.Limit, func(d RoomDetail) uuid.UUID { return d.ID }))
}

func (h *Handler) getRoom(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.GetRoom(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	eq, _ := h.svc.RoomEquipment(r.Context(), id)
	httpx.JSON(w, http.StatusOK, map[string]any{"room": room, "equipment": eq})
}

func (h *Handler) createRoom(w http.ResponseWriter, r *http.Request) {
	in, err := h.parseRoomInput(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.CreateRoom(r.Context(), in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "CREATE", "room", room.ID, room)
	httpx.Created(w, room)
}

func (h *Handler) updateRoom(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	in, err := h.parseRoomInput(r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.UpdateRoom(r.Context(), id, in)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "room", room.ID, room)
	httpx.JSON(w, http.StatusOK, room)
}

func (h *Handler) deactivateRoom(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.SetRoomStatus(r.Context(), id, dbgen.RoomStatusINACTIVE)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "room.status", room.ID, "INACTIVE")
	httpx.JSON(w, http.StatusOK, room)
}

func (h *Handler) activateRoom(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.SetRoomStatus(r.Context(), id, dbgen.RoomStatusACTIVE)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "room.status", room.ID, "ACTIVE")
	httpx.JSON(w, http.StatusOK, room)
}

type setEquipmentReq struct {
	Equipment []EquipmentLine `json:"equipment"`
}

func (h *Handler) setRoomEquipment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req setEquipmentReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.SetRoomEquipment(r.Context(), id, req.Equipment); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	eq, _ := h.svc.RoomEquipment(r.Context(), id)
	h.record(r, "UPDATE", "room.equipment", id, req.Equipment)
	httpx.JSON(w, http.StatusOK, map[string]any{"equipment": eq})
}

func (h *Handler) parseRoomInput(r *http.Request) (RoomInput, error) {
	var req roomReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		return RoomInput{}, err
	}
	bID, err := uuid.Parse(req.BuildingID)
	if err != nil {
		return RoomInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "building_id", Message: "must be a UUID"})
	}
	rt, ok := parseRoomType(req.RoomType)
	if !ok {
		return RoomInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "room_type", Message: "invalid room type"})
	}
	in := RoomInput{RoomCode: req.RoomCode, Name: req.Name, BuildingID: bID, Capacity: req.Capacity, RoomType: rt}
	if req.Status != "" {
		in.Status = dbgen.RoomStatus(req.Status)
	}
	return in, nil
}

func (h *Handler) attachEquipment(r *http.Request, rooms []RoomDetail) {
	for i := range rooms {
		eq, err := h.svc.RoomEquipment(r.Context(), rooms[i].ID)
		if err != nil {
			continue
		}
		lines := make([]EquipmentLine, len(eq))
		for j, e := range eq {
			lines[j] = EquipmentLine{
				EquipmentID: e.EquipmentID,
				Code:        e.Code,
				Name:        e.Name,
				ImageUrl:    e.ImageUrl,
				Quantity:    int(e.Quantity),
			}
		}
		rooms[i].Equipment = lines
	}
}

func (h *Handler) record(r *http.Request, action, entity string, id uuid.UUID, after any) {
	actor := auth.MustIdentity(r.Context()).UserID
	eid := id
	h.audit.Record(r.Context(), audit.Entry{
		ActorID: &actor, Action: action, EntityType: entity, EntityID: &eid, After: after,
		IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r),
	})
}

func parseRoomType(s string) (dbgen.RoomType, bool) {
	switch dbgen.RoomType(s) {
	case dbgen.RoomTypeLECTUREHALL, dbgen.RoomTypeLAB, dbgen.RoomTypeSEMINARROOM, dbgen.RoomTypeAUDITORIUM, dbgen.RoomTypeCONFERENCEROOM:
		return dbgen.RoomType(s), true
	default:
		return "", false
	}
}
