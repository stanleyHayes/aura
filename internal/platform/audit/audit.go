// Package audit writes append-only audit entries (§6.9, §14). Every state change
// records who did what, with a before/after diff. The table is append-only by
// database privilege, not convention.
package audit

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// Inserter is the subset of the data layer audit needs (pool- or tx-bound).
type Inserter interface {
	InsertAuditLog(ctx context.Context, arg dbgen.InsertAuditLogParams) error
}

type Recorder struct {
	q   Inserter
	log *slog.Logger
}

func New(q Inserter, log *slog.Logger) *Recorder { return &Recorder{q: q, log: log} }

// Entry describes a single audited action.
type Entry struct {
	ActorID    *uuid.UUID
	Action     string // CREATE|UPDATE|DELETE|APPROVE|REJECT|OVERRIDE|LOGIN|LOGIN_FAILED|...
	EntityType string
	EntityID   *uuid.UUID
	Before     any
	After      any
	IP         *string
	UserAgent  *string
}

// Record persists an audit entry. Failures are logged, never fatal to the
// request — but in production audit failures should alert (§15).
func (r *Recorder) Record(ctx context.Context, e Entry) {
	var changes []byte
	if e.Before != nil || e.After != nil {
		changes, _ = json.Marshal(map[string]any{"before": e.Before, "after": e.After})
	}
	err := r.q.InsertAuditLog(ctx, dbgen.InsertAuditLogParams{
		ActorID:    e.ActorID,
		Action:     e.Action,
		EntityType: e.EntityType,
		EntityID:   e.EntityID,
		Changes:    changes,
		IpAddress:  e.IP,
		UserAgent:  e.UserAgent,
	})
	if err != nil {
		r.log.Error("audit write failed", "action", e.Action, "entity", e.EntityType, "err", err)
	}
}
