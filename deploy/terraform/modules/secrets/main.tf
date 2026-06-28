# Secret manager (§14 "Secrets", §19.1). Two classes:
#   1. Terraform-seeded: connection strings derived from data stores.
#   2. App-managed (created empty): JWT/MFA keys and mail/Sentry creds that
#      Terraform must never observe; populated and rotated out of band, then
#      synced into Kubernetes via ExternalSecret (see deploy/helm/cbs).

locals {
  effective_prefix = var.secret_prefix != "" ? var.secret_prefix : replace(var.name_prefix, "-", "/")

  # The map VALUES are sensitive (connection strings), but the KEYS (logical
  # paths such as "database/url") are not — so iterate over the keys. Sensitive
  # values cannot drive for_each, but they can safely flow into secret_string.
  seeded_keys = nonsensitive(toset(keys(var.secret_values)))
}

# 1. Terraform-seeded secrets (DB/Redis/S3 connection details).
resource "aws_secretsmanager_secret" "seeded" {
  for_each = local.seeded_keys

  name                    = "${local.effective_prefix}/${each.value}"
  description             = "CBS ${each.value} (Terraform-managed)."
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "seeded" {
  for_each = local.seeded_keys

  secret_id     = aws_secretsmanager_secret.seeded[each.value].id
  secret_string = var.secret_values[each.value]
}

# 2. App-managed secrets — created empty; value owned/rotated by the app team.
resource "aws_secretsmanager_secret" "app_managed" {
  for_each = toset(var.managed_app_secret_keys)

  name                    = "${local.effective_prefix}/${each.value}"
  description             = "CBS ${each.value} (app-managed; rotated out of band)."
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags

  lifecycle {
    # Never let Terraform clobber a rotated value.
    ignore_changes = [tags["LastRotated"]]
  }
}
