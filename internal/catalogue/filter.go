package catalogue

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
)

// ParseRoomFilter builds a RoomFilter from request query parameters (FR6 / §8.3).
func ParseRoomFilter(r *http.Request) RoomFilter {
	q := r.URL.Query()
	f := RoomFilter{Cursor: httpx.Cursor(r), Limit: httpx.Limit(r)}

	if v := q.Get("building_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			f.BuildingID = &id
		}
	}
	if v := q.Get("min_capacity"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			f.MinCapacity = &n
		}
	}
	if v := q.Get("room_type"); v != "" {
		if rt, ok := parseRoomType(v); ok {
			f.RoomType = &rt
		}
	}
	if v := q.Get("status"); v != "" {
		st := dbgen.RoomStatus(v)
		f.Status = &st
	}
	if v := q.Get("equipment"); v != "" {
		for _, code := range strings.Split(v, ",") {
			if c := strings.TrimSpace(code); c != "" {
				f.EquipmentCodes = append(f.EquipmentCodes, c)
			}
		}
	}
	if v := q.Get("q"); v != "" {
		f.NameQuery = v
	}
	return f
}
