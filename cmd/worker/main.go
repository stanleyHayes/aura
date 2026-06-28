// Command worker runs background jobs (§7.2, §7.8, ADR-0002). Today it runs the
// periodic booking-expiry sweep and idempotency-key cleanup on tickers; in
// production these become River periodic jobs behind the same data layer, plus
// email/push dispatch and report exports.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aura/cbs/internal/platform/config"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	log := logging.New(slog.LevelInfo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store, err := db.New(ctx, cfg.DatabaseURL, cfg.InstitutionTZ)
	if err != nil {
		log.Error("db", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	log.Info("worker started")

	expire := time.NewTicker(time.Minute)
	cleanup := time.NewTicker(time.Hour)
	defer expire.Stop()
	defer cleanup.Stop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	// Run an immediate sweep on startup.
	sweepExpired(ctx, store, log)

	for {
		select {
		case <-stop:
			log.Info("worker shutting down")
			return
		case <-expire.C:
			sweepExpired(ctx, store, log)
		case <-cleanup.C:
			if err := store.DeleteExpiredIdempotencyKeys(ctx); err != nil {
				log.Error("idempotency cleanup", "err", err)
			}
		}
	}
}

// sweepExpired marks PENDING bookings whose start time has passed as EXPIRED (§7.2).
func sweepExpired(ctx context.Context, store *db.Store, log *slog.Logger) {
	n, err := store.ExpireStalePending(ctx)
	if err != nil {
		log.Error("expire sweep", "err", err)
		return
	}
	if n > 0 {
		log.Info("expired stale pending bookings", "count", n)
	}
}
