// Package seed embeds the idempotent demo seed SQL so the API can load it on
// startup (SEED_DATA=true) without a filesystem dependency — mirroring how
// db/migrations embeds the goose migrations.
package seed

import _ "embed"

// SQL is the contents of seed.sql: a single multi-statement script that must be
// executed with the pgx SIMPLE query protocol (pgconn Exec), since the extended
// protocol used by pool.Exec runs only one statement per call.
//
//go:embed seed.sql
var SQL string
