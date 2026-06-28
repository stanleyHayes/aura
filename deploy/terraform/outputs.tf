# Root outputs. Connection URLs are sensitive — consumed by the secrets module
# and the Helm/ExternalSecret layer, never logged.

output "postgres_primary_endpoint" {
  description = "Primary PostgreSQL endpoint (host:port)."
  value       = module.postgres.primary_endpoint
}

output "postgres_replica_endpoint" {
  description = "Read-replica PostgreSQL endpoint (host:port); empty if disabled."
  value       = module.postgres.replica_endpoint
}

output "redis_endpoint" {
  description = "Redis/Valkey primary endpoint."
  value       = module.redis.primary_endpoint
}

output "object_storage_bucket" {
  description = "Name of the private, versioned object-storage bucket."
  value       = module.object_storage.bucket_name
}

output "cdn_domain_name" {
  description = "CDN distribution domain name."
  value       = module.cdn_waf.distribution_domain_name
}

output "secrets_manager_prefix" {
  description = "Secret-manager path prefix for this environment (used by ExternalSecret)."
  value       = module.secrets.secret_prefix
}

output "kubernetes_cluster_endpoint" {
  description = "API endpoint of the referenced Kubernetes cluster."
  value       = module.kubernetes.cluster_endpoint
}
