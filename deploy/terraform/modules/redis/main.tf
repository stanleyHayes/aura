# Managed Redis/Valkey 8 (§18.2): cache, distributed rate limiting, SSE pub/sub.
# Multi-AZ with automatic failover; encryption in transit and at rest (§14 A02).

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-cache"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-cache"
  description = "Ingress to Redis/Valkey from application nodes only."
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_vpc_security_group_ingress_rule" "from_app" {
  for_each = toset(var.allowed_security_groups)

  security_group_id            = aws_security_group.redis.id
  referenced_security_group_id = each.value
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Redis from app security group ${each.value}"
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.name_prefix}-cache"
  description          = "CBS cache / rate-limit / pub-sub (Valkey)."

  engine         = "valkey"
  engine_version = var.engine_version
  node_type      = var.node_type
  port           = 6379

  num_node_groups            = 1
  replicas_per_node_group    = var.replicas_per_node_group
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window          = "01:00-02:00"
  maintenance_window       = "sun:02:30-sun:03:30"

  tags = var.tags
}
