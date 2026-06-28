// Command migrate runs goose database migrations (expand → migrate → contract;
// §6.10). Usage: migrate [up|down|status|version]. Defaults to "up".
// Migrations are embedded, so the distroless image needs no extra files.
package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	migrations "github.com/aura/cbs/db/migrations"
)

func main() {
	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	url := os.Getenv("DATABASE_URL")
	if url == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := sql.Open("pgx", url)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer func() { _ = db.Close() }()

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("dialect: %v", err)
	}
	if err := goose.RunContext(context.Background(), command, db, "."); err != nil {
		// #nosec G706 -- command is an operator-supplied CLI subcommand, not untrusted input.
		log.Fatalf("goose %s: %v", command, err)
	}
}
