package auth

import (
	"context"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// Identity is the authenticated caller, derived from a verified access token.
type Identity struct {
	UserID uuid.UUID
	Role   dbgen.UserRole
	Email  string
}

type ctxKey int

const identityKey ctxKey = iota

// WithIdentity stores the identity in the request context.
func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, identityKey, id)
}

// FromContext returns the identity and whether one is present.
func FromContext(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(identityKey).(Identity)
	return id, ok
}

// MustIdentity returns the identity, assuming authentication middleware ran.
func MustIdentity(ctx context.Context) Identity {
	id, _ := FromContext(ctx)
	return id
}
