output "primary_endpoint" {
  description = "Primary endpoint address for writes."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint address for reads."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "connection_url" {
  description = "REDIS_URL (rediss:// — TLS in transit). Sensitive."
  value       = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379/0"
  sensitive   = true
}

output "security_group_id" {
  description = "Security group guarding Redis/Valkey."
  value       = aws_security_group.redis.id
}
