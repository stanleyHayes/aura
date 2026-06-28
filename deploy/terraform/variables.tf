# Root input variables. Supply per environment via a .tfvars file
# (see environments/<env>/terraform.tfvars).

variable "project" {
  description = "Project slug used to prefix resource names."
  type        = string
  default     = "cbs"
}

variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production."
  }
}

variable "region" {
  description = "Cloud region for all regional resources."
  type        = string
  default     = "eu-west-2"
}

variable "vpc_id" {
  description = "ID of the VPC hosting the workloads and managed services."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for the database, cache and worker nodes."
  type        = list(string)
}

variable "tags" {
  description = "Common tags applied to all resources."
  type        = map(string)
  default     = {}
}

# ── PostgreSQL ───────────────────────────────────────────────────────────────
variable "postgres_instance_class" {
  description = "Instance class for the managed PostgreSQL primary and replica."
  type        = string
  default     = "db.r6g.large"
}

variable "postgres_allocated_storage_gb" {
  description = "Allocated storage for the primary, in GB."
  type        = number
  default     = 100
}

variable "postgres_backup_retention_days" {
  description = "Automated backup / PITR retention window in days (§18.3 RPO)."
  type        = number
  default     = 14
}

variable "create_read_replica" {
  description = "Whether to provision a read replica for reporting/availability."
  type        = bool
  default     = true
}

# ── Redis / Valkey ───────────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "Node type for the managed Redis/Valkey cluster."
  type        = string
  default     = "cache.t4g.medium"
}

# ── DNS / CDN ────────────────────────────────────────────────────────────────
variable "public_domain" {
  description = "Public domain served via the CDN + WAF (e.g. cbs.example.edu)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for the CDN (must be in us-east-1)."
  type        = string
  default     = ""
}

variable "eks_cluster_name" {
  description = "Name of the existing Kubernetes (EKS) cluster to reference."
  type        = string
}
