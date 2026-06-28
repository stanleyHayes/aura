# ADR-0003: Data access (sqlc/pgx) and token signing

**Status:** Accepted
**Date:** 2026-06-28

## Context

§5.2 mandates `pgx/v5` + `sqlc` (no ORM, parameterised queries only — §0.3) and
§9.1 specifies short-lived access JWTs (RS256 or EdDSA) plus opaque rotating
refresh tokens.

## Decision

1. **Data access** — `sqlc` generates a type-safe `dbgen` package from
   `db/migrations` + `db/queries`. No raw SQL string interpolation anywhere; the
   exclusion constraints and the `fn_validate_booking` trigger are the ultimate
   guarantee (§0.3, §6.6, §6.7). Where a dynamic filter set is unavoidable
   (availability/room search), queries are built with parameter placeholders only
   — never string-concatenated values.

2. **JWT signing** — the `auth.TokenSigner` interface abstracts the algorithm.
   Production uses **EdDSA** (Ed25519) with a key id for rotation. For local dev
   and tests an **HMAC (HS256)** signer is available behind the same interface,
   selected by the form of `JWT_SIGNING_KEY`. Refresh tokens are 256-bit random,
   stored only as SHA-256 hashes, **rotated on every refresh**, with family
   reuse-detection that revokes the whole chain (§9.1).

## Consequences

- `make generate` (sqlc) is part of CI; committed generated code must not drift.
- Switching dev↔prod signing is a configuration change, not a code change.

## Note: ip_address stored as `text`

The audit and refresh-token tables store the client IP as `text` rather than
`inet`. pgx's binary decoder cannot scan `inet` into a Go `string`, and modelling
it as `netip.Prefix` would force every audit call site to convert. IP is captured
for security logging, not for subnet queries, so `text` is the pragmatic, fully
functional choice. Revisit if CIDR/containment queries are ever needed.
