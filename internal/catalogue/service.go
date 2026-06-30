// Package catalogue owns buildings, equipment, rooms and the room equipment
// matrix (§6.4, FR2). It also provides the room-filtering query reused by the
// availability engine (candidate selection in §7.1).
package catalogue

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

type Service struct {
	store *db.Store
}

func NewService(store *db.Store) *Service { return &Service{store: store} }

type ImageAssetInput struct {
	URL      string
	PublicID string
}

// ── Buildings ────────────────────────────────────────────────────────────────

func (s *Service) CreateBuilding(ctx context.Context, code, name string, campus *string) (dbgen.Building, error) {
	b, err := s.store.CreateBuilding(ctx, dbgen.CreateBuildingParams{Code: code, Name: name, Campus: campus})
	return b, db.MapError(err)
}
func (s *Service) ListBuildings(ctx context.Context) ([]dbgen.Building, error) {
	return s.store.ListBuildings(ctx)
}
func (s *Service) GetBuilding(ctx context.Context, id uuid.UUID) (dbgen.Building, error) {
	b, err := s.store.GetBuilding(ctx, id)
	return b, db.MapError(err)
}
func (s *Service) UpdateBuilding(ctx context.Context, id uuid.UUID, code, name string, campus *string) (dbgen.Building, error) {
	b, err := s.store.UpdateBuilding(ctx, dbgen.UpdateBuildingParams{ID: id, Code: code, Name: name, Campus: campus})
	return b, db.MapError(err)
}
func (s *Service) UpdateBuildingImages(ctx context.Context, id uuid.UUID, main *ImageAssetInput, gallery []ImageAssetInput) (dbgen.Building, error) {
	b, err := s.store.GetBuilding(ctx, id)
	if err != nil {
		return dbgen.Building{}, db.MapError(err)
	}
	imageURL := b.ImageUrl
	imagePublicID := b.ImagePublicID
	if main != nil {
		imageURL = &main.URL
		imagePublicID = &main.PublicID
	}
	galleryURLs := append([]string{}, b.GalleryUrls...)
	galleryPublicIDs := append([]string{}, b.GalleryPublicIds...)
	for _, item := range gallery {
		galleryURLs = append(galleryURLs, item.URL)
		galleryPublicIDs = append(galleryPublicIDs, item.PublicID)
	}
	out, err := s.store.UpdateBuildingImages(ctx, dbgen.UpdateBuildingImagesParams{
		ID: id, ImageUrl: imageURL, ImagePublicID: imagePublicID,
		GalleryUrls: galleryURLs, GalleryPublicIds: galleryPublicIDs,
	})
	return out, db.MapError(err)
}
func (s *Service) DeleteBuilding(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteBuilding(ctx, id))
}

// ── Equipment ────────────────────────────────────────────────────────────────

func (s *Service) CreateEquipment(ctx context.Context, code, name string) (dbgen.Equipment, error) {
	e, err := s.store.CreateEquipment(ctx, dbgen.CreateEquipmentParams{Code: code, Name: name})
	return e, db.MapError(err)
}
func (s *Service) ListEquipment(ctx context.Context) ([]dbgen.Equipment, error) {
	return s.store.ListEquipment(ctx)
}
func (s *Service) GetEquipment(ctx context.Context, id uuid.UUID) (dbgen.Equipment, error) {
	e, err := s.store.GetEquipment(ctx, id)
	return e, db.MapError(err)
}
func (s *Service) UpdateEquipment(ctx context.Context, id uuid.UUID, code, name string) (dbgen.Equipment, error) {
	e, err := s.store.UpdateEquipment(ctx, dbgen.UpdateEquipmentParams{ID: id, Code: code, Name: name})
	return e, db.MapError(err)
}
func (s *Service) UpdateEquipmentImages(ctx context.Context, id uuid.UUID, main *ImageAssetInput, gallery []ImageAssetInput) (dbgen.Equipment, error) {
	e, err := s.store.GetEquipment(ctx, id)
	if err != nil {
		return dbgen.Equipment{}, db.MapError(err)
	}
	imageURL := e.ImageUrl
	imagePublicID := e.ImagePublicID
	if main != nil {
		imageURL = &main.URL
		imagePublicID = &main.PublicID
	}
	galleryURLs := append([]string{}, e.GalleryUrls...)
	galleryPublicIDs := append([]string{}, e.GalleryPublicIds...)
	for _, item := range gallery {
		galleryURLs = append(galleryURLs, item.URL)
		galleryPublicIDs = append(galleryPublicIDs, item.PublicID)
	}
	out, err := s.store.UpdateEquipmentImages(ctx, dbgen.UpdateEquipmentImagesParams{
		ID: id, ImageUrl: imageURL, ImagePublicID: imagePublicID,
		GalleryUrls: galleryURLs, GalleryPublicIds: galleryPublicIDs,
	})
	return out, db.MapError(err)
}
func (s *Service) DeleteEquipment(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteEquipment(ctx, id))
}

// ── Rooms ────────────────────────────────────────────────────────────────────

type RoomInput struct {
	RoomCode   string
	Name       string
	BuildingID uuid.UUID
	Capacity   int
	RoomType   dbgen.RoomType
	Status     dbgen.RoomStatus
}

func (s *Service) CreateRoom(ctx context.Context, in RoomInput) (dbgen.Room, error) {
	if in.Capacity <= 0 || in.Capacity > 1000000 {
		return dbgen.Room{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "capacity", Message: "must be between 1 and 1000000"})
	}
	if in.Status == "" {
		in.Status = dbgen.RoomStatusACTIVE
	}
	r, err := s.store.CreateRoom(ctx, dbgen.CreateRoomParams{
		RoomCode: in.RoomCode, Name: in.Name, BuildingID: in.BuildingID,
		Capacity: int32(in.Capacity), RoomType: in.RoomType, Status: in.Status,
	})
	return r, db.MapError(err)
}

func (s *Service) GetRoom(ctx context.Context, id uuid.UUID) (dbgen.Room, error) {
	return s.store.GetRoom(ctx, id)
}

func (s *Service) UpdateRoom(ctx context.Context, id uuid.UUID, in RoomInput) (dbgen.Room, error) {
	r, err := s.store.UpdateRoom(ctx, dbgen.UpdateRoomParams{
		ID: id, RoomCode: in.RoomCode, Name: in.Name, BuildingID: in.BuildingID,
		Capacity: int32(in.Capacity), RoomType: in.RoomType, Status: in.Status,
	})
	return r, db.MapError(err)
}

func (s *Service) UpdateRoomImages(ctx context.Context, id uuid.UUID, main *ImageAssetInput, gallery []ImageAssetInput) (dbgen.Room, error) {
	r, err := s.store.GetRoom(ctx, id)
	if err != nil {
		return dbgen.Room{}, db.MapError(err)
	}
	imageURL := r.ImageUrl
	imagePublicID := r.ImagePublicID
	if main != nil {
		imageURL = &main.URL
		imagePublicID = &main.PublicID
	}
	galleryURLs := append([]string{}, r.GalleryUrls...)
	galleryPublicIDs := append([]string{}, r.GalleryPublicIds...)
	for _, item := range gallery {
		galleryURLs = append(galleryURLs, item.URL)
		galleryPublicIDs = append(galleryPublicIDs, item.PublicID)
	}
	out, err := s.store.UpdateRoomImages(ctx, dbgen.UpdateRoomImagesParams{
		ID: id, ImageUrl: imageURL, ImagePublicID: imagePublicID,
		GalleryUrls: galleryURLs, GalleryPublicIds: galleryPublicIDs,
	})
	return out, db.MapError(err)
}

func (s *Service) SetRoomStatus(ctx context.Context, id uuid.UUID, status dbgen.RoomStatus) (dbgen.Room, error) {
	r, err := s.store.SetRoomStatus(ctx, dbgen.SetRoomStatusParams{ID: id, Status: status})
	return r, db.MapError(err)
}

// SetRoomEquipment replaces a room's equipment list atomically (PUT semantics).
func (s *Service) SetRoomEquipment(ctx context.Context, roomID uuid.UUID, items []EquipmentLine) error {
	return s.store.WithinTxDefault(ctx, func(q *dbgen.Queries, _ pgx.Tx) error {
		if err := q.ClearRoomEquipment(ctx, roomID); err != nil {
			return err
		}
		for _, it := range items {
			if err := q.AddRoomEquipment(ctx, dbgen.AddRoomEquipmentParams{
				RoomID: roomID, EquipmentID: it.EquipmentID, Quantity: int32(it.Quantity),
			}); err != nil {
				return db.MapError(err)
			}
		}
		return nil
	})
}

func (s *Service) RoomEquipment(ctx context.Context, roomID uuid.UUID) ([]dbgen.ListRoomEquipmentRow, error) {
	return s.store.ListRoomEquipment(ctx, roomID)
}

// EquipmentLine is one entry in a room's equipment matrix.
type EquipmentLine struct {
	EquipmentID uuid.UUID `json:"equipment_id"`
	Quantity    int       `json:"quantity"`
}

// ── Room search (dynamic, parameterised — no string-interpolated values) ──────

// RoomFilter expresses the FR6 search filters; also used for candidate selection.
type RoomFilter struct {
	BuildingID     *uuid.UUID
	MinCapacity    *int
	RoomType       *dbgen.RoomType
	Status         *dbgen.RoomStatus
	EquipmentCodes []string
	NameQuery      string
	Cursor         *uuid.UUID
	Limit          int
}

// RoomDetail is a room plus its building label and equipment.
type RoomDetail struct {
	dbgen.Room
	BuildingCode string          `json:"building_code"`
	BuildingName string          `json:"building_name"`
	Equipment    []EquipmentLine `json:"equipment,omitempty"`
}

// SearchRooms returns rooms matching the filter. Every value is bound as a query
// parameter ($1, $2, …) — never concatenated into SQL (§0.3, §14 A03).
func (s *Service) SearchRooms(ctx context.Context, f RoomFilter) ([]RoomDetail, error) {
	var sb strings.Builder
	args := []any{}
	add := func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }

	sb.WriteString(`SELECT r.id, r.room_code, r.name, r.building_id, r.capacity, r.room_type,
		r.status, r.created_at, r.updated_at, r.image_url, r.image_public_id,
		r.gallery_urls, r.gallery_public_ids, b.code, b.name
		FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE 1=1`)

	if f.Status != nil {
		sb.WriteString(" AND r.status = " + add(*f.Status))
	}
	if f.BuildingID != nil {
		sb.WriteString(" AND r.building_id = " + add(*f.BuildingID))
	}
	if f.MinCapacity != nil {
		sb.WriteString(" AND r.capacity >= " + add(int32(*f.MinCapacity)))
	}
	if f.RoomType != nil {
		sb.WriteString(" AND r.room_type = " + add(*f.RoomType))
	}
	if f.NameQuery != "" {
		sb.WriteString(" AND r.name ILIKE " + add("%"+f.NameQuery+"%"))
	}
	if len(f.EquipmentCodes) > 0 {
		codesPH := add(f.EquipmentCodes)
		countPH := add(int32(len(f.EquipmentCodes)))
		sb.WriteString(` AND r.id IN (
			SELECT re.room_id FROM room_equipment re JOIN equipment e ON e.id = re.equipment_id
			WHERE e.code = ANY(` + codesPH + `) GROUP BY re.room_id
			HAVING count(DISTINCT e.code) = ` + countPH + `)`)
	}
	if f.Cursor != nil {
		sb.WriteString(" AND r.id > " + add(*f.Cursor))
	}
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	sb.WriteString(" ORDER BY r.id LIMIT " + add(int32(limit)))

	rows, err := s.store.ReplicaPool.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RoomDetail
	for rows.Next() {
		var d RoomDetail
		if err := rows.Scan(&d.ID, &d.RoomCode, &d.Name, &d.BuildingID, &d.Capacity,
			&d.RoomType, &d.Status, &d.CreatedAt, &d.UpdatedAt, &d.ImageUrl, &d.ImagePublicID,
			&d.GalleryUrls, &d.GalleryPublicIds, &d.BuildingCode, &d.BuildingName); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
