# Classroom Booking System — developer task runner
# British English throughout. See README.md and docs/.

SHELL := /bin/bash
GO ?= go
PKG := github.com/aura/cbs

# Local isolated PostgreSQL 18 cluster (no Docker required) lives under .pgdata.
PGDATA := $(CURDIR)/.pgdata
PGPORT ?= 5433
PGHOST := localhost
DB_NAME ?= cbs
TEST_DATABASE_URL ?= postgres://$(USER)@$(PGHOST):$(PGPORT)/$(DB_NAME)?sslmode=disable
DATABASE_URL ?= $(TEST_DATABASE_URL)
export DATABASE_URL

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

## ── Build & quality ────────────────────────────────────────────
.PHONY: build
build: ## Build all binaries into ./bin
	$(GO) build -o bin/api ./cmd/api
	$(GO) build -o bin/worker ./cmd/worker
	$(GO) build -o bin/migrate ./cmd/migrate

.PHONY: tidy
tidy: ## go mod tidy
	$(GO) mod tidy

.PHONY: generate
generate: ## Regenerate sqlc type-safe data layer
	sqlc generate

.PHONY: lint
lint: ## Run golangci-lint
	golangci-lint run ./...

.PHONY: vet
vet: ## go vet
	$(GO) vet ./...

.PHONY: vuln
vuln: ## govulncheck
	govulncheck ./...

.PHONY: fmt
fmt: ## Format code
	gofumpt -w . || gofmt -w .

## ── Test ───────────────────────────────────────────────────────
.PHONY: test
test: ## Run all tests (needs a running DB via DATABASE_URL)
	$(GO) test ./... -count=1

.PHONY: test-unit
test-unit: ## Run unit tests only (no DB)
	$(GO) test ./internal/availability/... ./internal/platform/rbac/... ./internal/platform/auth/... -count=1

.PHONY: test-cover
test-cover: ## Run tests with coverage
	$(GO) test ./... -count=1 -coverprofile=coverage.out
	$(GO) tool cover -func=coverage.out | tail -1

.PHONY: ci
ci: ## Run the full local quality gate (fmt check, vet, lint, vuln, tests)
	@gofmt -l cmd internal db | tee /dev/stderr | (! read) || (echo "gofmt: files need formatting" && exit 1)
	$(GO) vet ./...
	golangci-lint run ./...
	$(GO) test ./... -count=1

## ── Local isolated Postgres 18 (no Docker) ─────────────────────
.PHONY: pg-init
pg-init: ## Initialise the local .pgdata cluster
	@test -d $(PGDATA) || initdb -D $(PGDATA) -U $(USER) --auth=trust >/dev/null

.PHONY: pg-start
pg-start: pg-init ## Start the local Postgres on $(PGPORT)
	@pg_ctl -D $(PGDATA) -o "-p $(PGPORT)" -l $(PGDATA)/server.log start || true
	@sleep 1
	@createdb -p $(PGPORT) -U $(USER) $(DB_NAME) 2>/dev/null || true

.PHONY: pg-stop
pg-stop: ## Stop the local Postgres
	@pg_ctl -D $(PGDATA) stop || true

## ── Migrations & seed ──────────────────────────────────────────
.PHONY: migrate-up
migrate-up: ## Apply all goose migrations
	goose -dir db/migrations postgres "$(DATABASE_URL)" up

.PHONY: migrate-down
migrate-down: ## Roll back one migration (local/staging only)
	goose -dir db/migrations postgres "$(DATABASE_URL)" down

.PHONY: migrate-status
migrate-status: ## Show migration status
	goose -dir db/migrations postgres "$(DATABASE_URL)" status

.PHONY: seed
seed: ## Load reference + demo data
	psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -f db/seed/seed.sql

## ── Compose dev stack (requires Docker) ────────────────────────
.PHONY: dev
dev: ## Bring up the full local stack via Docker Compose
	docker compose -f deploy/compose/docker-compose.yml up --build

.PHONY: dev-down
dev-down: ## Tear down the Docker Compose stack
	docker compose -f deploy/compose/docker-compose.yml down -v

## ── One-shot local bootstrap (no Docker) ───────────────────────
.PHONY: localdb
localdb: pg-start migrate-up seed ## Start local PG, migrate, seed
	@echo "Local DB ready at $(DATABASE_URL)"

.PHONY: run-api
run-api: ## Run the API server against the local DB
	HTTP_PORT=8080 APP_INSTITUTION_TZ=Africa/Accra $(GO) run ./cmd/api
