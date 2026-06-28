# ADR-0009: Secret delivery via External Secrets Operator

**Status:** Accepted
**Date:** 2026-06-28

## Context

§14 ("Secrets") and §18.2 require secrets to be injected from a secret manager
(cloud secret manager / Vault / SOPS-encrypted) and **never** committed to the
repo, baked into images, or written to logs. The Helm chart must wire
`DATABASE_URL`, `JWT_SIGNING_KEY`, `MFA_ENCRYPTION_KEY`, S3 keys, mail creds and
`SENTRY_DSN` (§19.1) into the API and worker pods. We also need rotation
(`secret-rotation.md`), including key-ID rollover for the JWT signing key (§14
A07).

Options for getting secret-manager values into Kubernetes:

1. **External Secrets Operator (ESO)** — an `ExternalSecret` CRD syncs values
   from the backing secret manager into a native Kubernetes `Secret`.
2. **SOPS-encrypted manifests** decrypted at deploy time.
3. **Sealed Secrets** (encrypted Secrets committed to git).
4. **CSI Secrets Store driver** mounting secrets as files.

## Decision

Default to the **External Secrets Operator**. The chart renders an
`ExternalSecret` (`templates/externalsecret.yaml`) that pulls each key from the
secret manager (path prefix `cbs/<env>/...`, produced by Terraform
`modules/secrets`) into a Kubernetes `Secret`, consumed by the workloads via
`envFrom: secretRef` — alongside the non-secret `ConfigMap`.

The chart supports two alternatives without code changes:

- `existingSecret: <name>` — reference a Secret provisioned out of band (e.g.
  SOPS-decrypted in the pipeline, or Sealed Secrets) for clusters not running
  ESO.
- `secret.create: true` — chart-managed Secret, **for throwaway/local clusters
  only**; never used in real environments.

No secret value ever appears in `values.yaml`, the chart, or rendered output
under the default path — only references.

Reasons:

- **Single source of truth.** Secrets live in the cloud secret manager; ESO keeps
  the in-cluster `Secret` in sync on a `refreshInterval`, so rotation is "update
  the manager + resync + roll pods" (see `secret-rotation.md`) with no chart
  change.
- **Clean Terraform seam.** `modules/secrets` seeds connection strings and
  creates app-managed secrets (JWT/MFA/mail) **empty**, so values Terraform must
  never observe never enter Terraform state.
- **Rotation-friendly.** Key-ID rollover and overlapping credentials are handled
  by versioning in the secret manager, not by editing manifests.

## Consequences

- ESO (external-secrets.io) and a configured `ClusterSecretStore` are cluster
  prerequisites for the default path.
- The IRSA/workload-identity binding for ESO to read the secret manager is part
  of cluster setup (out of scope for the app chart).
- Forcing an immediate cutover after rotation uses an annotation-triggered
  resync plus `rollout restart` (documented in `secret-rotation.md`), because env
  is loaded at process start.
- Institutions standardised on SOPS or Sealed Secrets use `existingSecret` and
  skip ESO entirely; the workloads are identical either way.
