# Runbook: secret rotation

Rotate keys and credentials for AURA (Ashesi University Resource Allocation) (§14 "Secrets",
§19.1). Covers both **scheduled** rotation and **emergency** rotation after a
suspected leak. Secrets live in the cloud secret manager and are synced into
Kubernetes via `ExternalSecret` (see `deploy/helm/cbs`). They are never in the
repo, image, or logs.

## Secrets in scope

| Secret (§19.1) | Rotation style | Notes |
|---|---|---|
| `JWT_SIGNING_KEY` / `JWT_KEY_ID` | Key-ID rollover | Dual-key window; verify old + new, sign with new. |
| `MFA_ENCRYPTION_KEY` | Re-encrypt | AES-GCM for TOTP secrets; must re-encrypt stored secrets. |
| `DATABASE_URL` (password) | Credential rotate | Coordinate with the managed DB user. |
| `DATABASE_REPLICA_URL` | Credential rotate | Same DB user/password as primary, replica host. |
| `REDIS_URL` (auth token) | Credential rotate | Brief reconnect. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credential rotate | Use overlapping keys to avoid downtime. |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Credential rotate | Provider console. |
| `SENTRY_DSN` | Replace | Low risk; rotate if exposed. |

## General procedure (overlap, then cut over)

1. **Create the new secret value** in the secret manager alongside the old one
   (never overwrite-in-place for credentials that back live connections).
2. **Update the secret-manager entry / version** under the env prefix
   (`cbs/<env>/...`). The `ExternalSecret` resyncs on its `refreshInterval`
   (default 1h) — force an immediate sync to cut over now:

   ```sh
   # Trigger an immediate resync of the ExternalSecret.
   kubectl -n "$NS" annotate externalsecret cbs \
     force-sync="$(date +%s)" --overwrite
   kubectl -n "$NS" get secret cbs-secret -o jsonpath='{.metadata.resourceVersion}'
   ```

3. **Roll the pods** so the new value is read (env is loaded at start):

   ```sh
   kubectl -n "$NS" rollout restart deploy/cbs-api deploy/cbs-worker
   kubectl -n "$NS" rollout status  deploy/cbs-api --timeout=5m
   ```

4. **Verify**, then **revoke the old value** once nothing uses it.

## JWT signing key rollover (key-ID)

Tokens are signed with `JWT_KEY_ID`; the app verifies against a keyset. Roll
without invalidating live sessions:

1. Add the new key under a new `JWT_KEY_ID` (e.g. `prod-key-2`) and publish both
   keys to the verification keyset.
2. Update config so the app **verifies old + new** but **signs with the new**
   key id. Roll pods.
3. Wait at least `ACCESS_TOKEN_TTL` (15m) + a margin so all tokens signed with
   the old key have expired.
4. Remove the old key from the keyset; roll pods.
5. On suspected key compromise, skip the overlap: cut to the new key immediately
   and invalidate refresh tokens (forces re-login). See **Emergency** below.

## MFA encryption key rotation (re-encrypt)

`MFA_ENCRYPTION_KEY` (AES-GCM) encrypts stored TOTP secrets — rotating it
requires re-encrypting existing rows.

1. Provision the new key with overlap (app must accept old + new for decrypt).
2. Run the re-encryption job/migration that decrypts with the old key and
   re-encrypts with the new key.
3. Verify a sample of users can complete MFA.
4. Remove the old key once all rows are re-encrypted.

## Database / Redis / S3 credentials

1. Create a new credential (managed DB user password, Redis auth token, or a
   second S3 access key) **before** removing the old.
2. Update the corresponding secret-manager entry; resync + roll pods (general
   procedure).
3. Confirm connectivity (`/readyz` 200; no auth errors in logs).
4. Revoke the old credential.

For S3, prefer two active access keys during the window, then delete the old key.

## Emergency rotation (suspected leak)

1. **Declare a security incident.** Identify the exposed secret and blast radius.
2. **Revoke immediately** at the source (DB user, S3 key, mail creds, signing
   key) — do not wait for overlap.
3. Publish replacements, force `ExternalSecret` resync, roll pods.
4. For `JWT_SIGNING_KEY`: invalidate refresh tokens (reuse-detection/rotation,
   §14 A07) to force re-authentication.
5. Audit `audit_logs` and access logs for misuse during the exposure window.
6. Run `gitleaks` over history to confirm the secret is not in the repo; if it
   is, rotate AND purge history.

## Verify recovery (any rotation)

- `/readyz` 200 on all API pods; no auth/connection errors in logs or Sentry.
- A login + a booking flow succeed end-to-end (or in staging-equivalent).
- The old secret is fully revoked and no workload references it.
- Record the rotation date (e.g. a `LastRotated` tag) for the rotation schedule.

## Schedule

- Routine rotation per policy (e.g. quarterly for DB/S3/mail; signing keys per
  the institution's crypto policy). Out-of-band/app-managed secrets are created
  empty by Terraform (`modules/secrets`) precisely so rotation never round-trips
  through Terraform state.
