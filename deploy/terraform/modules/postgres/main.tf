# Managed PostgreSQL 18: primary + optional read replica, encrypted automated
# backups with point-in-time recovery (§18.2, §18.3). Skeleton — review storage,
# instance sizing, parameter group and maintenance windows before apply.

resource "random_password" "master" {
  length  = 32
  special = false # avoid URL-encoding pain in DATABASE_URL.
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-pg"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "postgres" {
  name        = "${var.name_prefix}-pg"
  description = "Ingress to PostgreSQL from application nodes only."
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_vpc_security_group_ingress_rule" "from_app" {
  for_each = toset(var.allowed_security_groups)

  security_group_id            = aws_security_group.postgres.id
  referenced_security_group_id = each.value
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from app security group ${each.value}"
}

# PostgreSQL 18 parameter group: force TLS, sensible logging for observability.
resource "aws_db_parameter_group" "this" {
  name        = "${var.name_prefix}-pg18"
  family      = "postgres18"
  description = "CBS PostgreSQL 18 parameters."

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500" # log queries slower than 500ms (§15 latency SLO).
  }

  tags = var.tags
}

resource "aws_db_instance" "primary" {
  identifier     = "${var.name_prefix}-pg-primary"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true # encryption at rest (§14 A02, §18.3).

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.postgres.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  multi_az               = true # HA failover (see runbook db-failover).

  # Backups + PITR (§18.3). RPO ≤ retention window; PITR to any second within it.
  backup_retention_period   = var.backup_retention_days
  backup_window             = "02:00-03:00"
  maintenance_window        = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-pg-final"

  # Enhanced observability (§15).
  performance_insights_enabled    = true
  monitoring_interval             = 60
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  auto_minor_version_upgrade      = false # patch deliberately via IaC.

  tags = var.tags
}

# Read replica for reporting/availability reads (§18.2).
resource "aws_db_instance" "replica" {
  count = var.create_read_replica ? 1 : 0

  identifier          = "${var.name_prefix}-pg-replica"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = var.instance_class
  storage_encrypted   = true

  vpc_security_group_ids = [aws_security_group.postgres.id]
  parameter_group_name   = aws_db_parameter_group.this.name

  performance_insights_enabled = true
  monitoring_interval          = 60
  auto_minor_version_upgrade   = false
  skip_final_snapshot          = true

  tags = var.tags
}
