variable "name_prefix" {
  description = "Prefix for secret paths (e.g. cbs-production)."
  type        = string
}

variable "secret_prefix" {
  description = "Logical path prefix in the secret manager (e.g. cbs/production)."
  type        = string
  default     = ""
}

variable "secret_values" {
  description = <<-EOT
    Map of "path/key" => value to seed into the secret manager. Connection
    strings produced by other modules are passed in here. App secrets that
    Terraform must NOT see (JWT_SIGNING_KEY, MFA_ENCRYPTION_KEY) are created
    empty and rotated out of band — see runbook secret-rotation.
  EOT
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "managed_app_secret_keys" {
  description = "Secret paths created empty for the app team to populate/rotate."
  type        = list(string)
  default = [
    "jwt/signing_key",
    "mfa/encryption_key",
    "mail/username",
    "mail/password",
    "sentry/dsn",
  ]
}

variable "recovery_window_days" {
  description = "Deletion recovery window for secrets."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
