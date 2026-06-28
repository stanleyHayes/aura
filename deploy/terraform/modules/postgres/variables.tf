variable "name_prefix" {
  description = "Prefix for all resource names (e.g. cbs-production)."
  type        = string
}

variable "vpc_id" {
  description = "VPC the database subnet group and security group live in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the DB subnet group (>=2 AZs)."
  type        = list(string)
}

variable "engine_version" {
  description = "PostgreSQL major.minor version (§18.2 requires 18)."
  type        = string
  default     = "18.1"
}

variable "instance_class" {
  description = "Instance class for primary and replica."
  type        = string
  default     = "db.r6g.large"
}

variable "allocated_storage_gb" {
  description = "Primary allocated storage in GB (autoscaling enabled)."
  type        = number
  default     = 100
}

variable "max_allocated_storage_gb" {
  description = "Upper bound for storage autoscaling in GB."
  type        = number
  default     = 1000
}

variable "backup_retention_days" {
  description = "Automated backup / PITR retention in days (§18.3, RPO)."
  type        = number
  default     = 14
}

variable "create_read_replica" {
  description = "Provision a read replica for reporting/availability reads."
  type        = bool
  default     = true
}

variable "allowed_security_groups" {
  description = "Security group IDs permitted to reach Postgres on 5432."
  type        = list(string)
  default     = []
}

variable "database_name" {
  description = "Initial database name."
  type        = string
  default     = "cbs"
}

variable "master_username" {
  description = "Master username for the primary."
  type        = string
  default     = "cbs_admin"
}

variable "deletion_protection" {
  description = "Block accidental deletion of the primary."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
