// Package migrations embeds the goose SQL migrations so the migrate binary and
// the API readiness check can run/verify them without a filesystem dependency.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
