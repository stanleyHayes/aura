// Package logging configures structured JSON logging (log/slog; §15) with a
// request-scoped correlation id propagated through context. Secrets/PII never logged.
package logging

import (
	"context"
	"log/slog"
	"os"
)

type ctxKey int

const correlationKey ctxKey = iota

// New returns a JSON slog logger at the given level.
func New(level slog.Level) *slog.Logger {
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(h)
}

// WithCorrelation stores a correlation id in the context.
func WithCorrelation(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, correlationKey, id)
}

// CorrelationID returns the correlation id from context, or "".
func CorrelationID(ctx context.Context) string {
	if v, ok := ctx.Value(correlationKey).(string); ok {
		return v
	}
	return ""
}

// FromContext returns a logger annotated with the correlation id.
func FromContext(ctx context.Context, base *slog.Logger) *slog.Logger {
	if id := CorrelationID(ctx); id != "" {
		return base.With("correlation_id", id)
	}
	return base
}
