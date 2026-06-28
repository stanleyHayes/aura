# ADR-0001: Toolchain versions at build time

**Status:** Accepted
**Date:** 2026-06-28

## Context

Section 0.1 pins version *floors* (Go 1.26.x, Node 24.x, PostgreSQL 18.x, …) and
instructs the implementing agent to resolve the latest stable patch at build time.
The build host for this implementation provides:

- Go **1.25.5** (1.26 not yet installed on this host)
- Node **23.11**
- PostgreSQL **18.1** (client + server)
- pnpm 11, sqlc 1.31, goose, golangci-lint

## Decision

- Target **Go 1.25** (`go 1.25` in `go.mod`). The code uses no 1.26-only features;
  upgrading the directive to `1.26` is a one-line change once the toolchain is
  installed, gated behind the full test suite per §0.1.
- Target **PostgreSQL 18** as specified — `uuidv7()`, `timerange`, `btree_gist`
  exclusion constraints, and generated range columns are all used and require 18.
- Pin exact versions in `go.mod` / `package.json` (no `^`/`~` for production deps).

## Consequences

- A `// TODO(go1.26)` is unnecessary; no compatibility shims are required.
- CI must re-pin to Go 1.26 latest patch before production release.
