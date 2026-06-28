output "primary_endpoint" {
  description = "Primary endpoint (host:port)."
  value       = aws_db_instance.primary.endpoint
}

output "replica_endpoint" {
  description = "Read-replica endpoint (host:port); empty when disabled."
  value       = var.create_read_replica ? aws_db_instance.replica[0].endpoint : ""
}

output "primary_connection_url" {
  description = "DATABASE_URL for the primary (read/write). Sensitive."
  value = format(
    "postgres://%s:%s@%s/%s?sslmode=require",
    var.master_username,
    random_password.master.result,
    aws_db_instance.primary.endpoint,
    var.database_name,
  )
  sensitive = true
}

output "replica_connection_url" {
  description = "DATABASE_REPLICA_URL (read-only). Empty when disabled. Sensitive."
  value = var.create_read_replica ? format(
    "postgres://%s:%s@%s/%s?sslmode=require",
    var.master_username,
    random_password.master.result,
    aws_db_instance.replica[0].endpoint,
    var.database_name,
  ) : ""
  sensitive = true
}

output "security_group_id" {
  description = "Security group guarding PostgreSQL."
  value       = aws_security_group.postgres.id
}
