output "secret_prefix" {
  description = "Path prefix under which all CBS secrets live (used by ExternalSecret)."
  value       = local.effective_prefix
}

output "seeded_secret_arns" {
  description = "ARNs of Terraform-seeded secrets keyed by logical path."
  value       = { for k, v in aws_secretsmanager_secret.seeded : k => v.arn }
}

output "app_managed_secret_arns" {
  description = "ARNs of app-managed (empty) secrets keyed by logical path."
  value       = { for k, v in aws_secretsmanager_secret.app_managed : k => v.arn }
}
