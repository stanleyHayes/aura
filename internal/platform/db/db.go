// Package db wraps the pgx connection pool and the sqlc-generated queries.
// It exposes a transaction helper used by the concurrency-sensitive booking
// approval path (§7.3) and sets the institution timezone per connection so the
// booking validation trigger (§6.7) computes local days correctly.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// Store is the data-access entry point. It embeds *dbgen.Queries (primary-bound)
// so non-transactional callers run against the primary by default. Read-only
// consumers (availability, reporting) use Read / ReplicaPool, which route to a
// read replica when one is attached and otherwise fall back to the primary
// (§5.4, §7.1, §18.2).
type Store struct {
	*dbgen.Queries
	Pool        *pgxpool.Pool
	Read        *dbgen.Queries
	ReplicaPool *pgxpool.Pool
}

// New opens a pool against url and configures each connection with the
// institution timezone (used by fn_validate_booking via current_setting).
func New(ctx context.Context, url, institutionTZ string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConnLifetime = time.Hour
	cfg.HealthCheckPeriod = 30 * time.Second
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		// Parameterised — never string-interpolated (§0.3).
		if _, err := conn.Exec(ctx, "SELECT set_config('app.institution_tz', $1, false)", institutionTZ); err != nil {
			return err
		}
		// Bound runaway queries and stuck transactions (§14 A04/DoS). Generous
		// enough for reports/imports; advisory-lock waits fail cleanly rather than
		// hanging a connection indefinitely.
		_, err := conn.Exec(ctx,
			"SET statement_timeout = '30s'; SET idle_in_transaction_session_timeout = '15s'")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	q := dbgen.New(pool)
	// Reads default to the primary until a replica is attached.
	return &Store{Queries: q, Pool: pool, Read: q, ReplicaPool: pool}, nil
}

// AttachReplica opens a read-replica pool and routes read-only queries to it.
// No-op when url is empty.
func (s *Store) AttachReplica(ctx context.Context, url, institutionTZ string) error {
	if url == "" {
		return nil
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("parse replica url: %w", err)
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SELECT set_config('app.institution_tz', $1, false)", institutionTZ)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("connect replica: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("ping replica: %w", err)
	}
	s.ReplicaPool = pool
	s.Read = dbgen.New(pool)
	return nil
}

func (s *Store) Close() {
	if s.ReplicaPool != nil && s.ReplicaPool != s.Pool {
		s.ReplicaPool.Close()
	}
	s.Pool.Close()
}

// Ping checks connectivity for readiness probes (§15).
func (s *Store) Ping(ctx context.Context) error { return s.Pool.Ping(ctx) }

// TxFn runs inside a transaction with queries bound to that transaction.
type TxFn func(q *dbgen.Queries, tx pgx.Tx) error

// WithinTx runs fn in a SERIALIZABLE transaction, committing on success and
// rolling back on error or panic (§7.3 approval race).
func (s *Store) WithinTx(ctx context.Context, fn TxFn) error {
	return s.withTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable}, fn)
}

// WithinTxDefault runs fn in a read-committed transaction.
func (s *Store) WithinTxDefault(ctx context.Context, fn TxFn) error {
	return s.withTx(ctx, pgx.TxOptions{}, fn)
}

func (s *Store) withTx(ctx context.Context, opts pgx.TxOptions, fn TxFn) (err error) {
	tx, err := s.Pool.BeginTx(ctx, opts)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()
	if err = fn(dbgen.New(tx), tx); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// AdvisoryXactLock takes a per-room transaction-scoped advisory lock so the
// lecture/maintenance re-check and the status flip are atomic (§7.3).
func AdvisoryXactLock(ctx context.Context, tx pgx.Tx, key string) error {
	_, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", key)
	return err
}
