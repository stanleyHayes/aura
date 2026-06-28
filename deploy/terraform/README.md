# CBS Terraform (IaC skeleton)

Infrastructure as Code for the Classroom Booking System (spec §18.2). This is a
reviewed, planned-in-CI **skeleton** — review sizing, networking, IAM and
parameter groups before any `apply`. The reference cloud is AWS; the modules are
written to be re-targetable.

## Layout

```
deploy/terraform
├── versions.tf            provider + backend constraints
├── variables.tf           root inputs
├── main.tf                root composition (wires the modules)
├── outputs.tf             root outputs (endpoints, secret prefix)
├── environments/
│   ├── staging/terraform.tfvars
│   └── production/terraform.tfvars
└── modules/
    ├── postgres/          managed PostgreSQL 18 (primary + replica, PITR)
    ├── redis/             managed Redis/Valkey 8 (multi-AZ, TLS)
    ├── object_storage/    private, versioned S3 bucket (TLS-only, KMS)
    ├── kubernetes/        references the existing EKS cluster
    ├── secrets/           secret manager (seeded + app-managed)
    └── cdn_waf/           CloudFront + WAFv2 (managed rulesets + rate limit)
```

## Usage

```sh
cd deploy/terraform
# 1. Provision the remote-state bucket + lock table once, then uncomment the
#    backend block in versions.tf and set the per-environment key.
terraform init

# 2. Plan / apply per environment.
terraform plan  -var-file=environments/staging/terraform.tfvars
terraform apply -var-file=environments/staging/terraform.tfvars
```

## Notes

- **State separation:** one state file per environment (backend `key`); never
  share state between staging and production.
- **Secrets:** Terraform seeds connection strings only. The application secrets
  (`JWT_SIGNING_KEY`, `MFA_ENCRYPTION_KEY`, mail, Sentry) are created **empty**
  and populated/rotated out of band — see `docs/runbooks/secret-rotation.md`.
  Kubernetes consumes them via `ExternalSecret` (see `deploy/helm/cbs`).
- **CI:** `terraform fmt -check`, `terraform validate` and a `plan` run on PRs
  per §17 ("planned in CI"). No `apply` from CI without manual approval.
- **DR:** PITR retention and S3 versioning back the RPO/RTO targets in §18.3;
  restores are drilled quarterly — see `docs/runbooks/restore-from-backup-drill.md`.
