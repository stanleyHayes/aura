# Root composition (§18.2). Wires the skeleton modules together for one
# environment. The provider is configured here; modules stay provider-agnostic
# where practical so the institution can re-target a different cloud.

provider "aws" {
  region = var.region

  default_tags {
    tags = local.common_tags
  }
}

# CloudFront and CLOUDFRONT-scoped WAF must be created in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      System      = "classroom-booking-system"
    },
    var.tags,
  )
}

# Reference (not create) the Kubernetes cluster the app runs on.
module "kubernetes" {
  source = "./modules/kubernetes"

  cluster_name = var.eks_cluster_name
  tags         = local.common_tags
}

# Secrets manager: holds DATABASE_URL, JWT_SIGNING_KEY, etc. (§14, §19.1).
# Connection strings from the data stores below are written into it.
module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
  tags        = local.common_tags

  secret_values = {
    "database/url"         = module.postgres.primary_connection_url
    "database/replica_url" = module.postgres.replica_connection_url
    "redis/url"            = module.redis.connection_url
    "s3/bucket"            = module.object_storage.bucket_name
  }
}

# Managed PostgreSQL 18: primary + read replica, PITR backups (§18.2, §18.3).
module "postgres" {
  source = "./modules/postgres"

  name_prefix             = local.name_prefix
  vpc_id                  = var.vpc_id
  subnet_ids              = var.private_subnet_ids
  instance_class          = var.postgres_instance_class
  allocated_storage_gb    = var.postgres_allocated_storage_gb
  backup_retention_days   = var.postgres_backup_retention_days
  create_read_replica     = var.create_read_replica
  allowed_security_groups = [module.kubernetes.node_security_group_id]
  tags                    = local.common_tags
}

# Managed Redis/Valkey 8 (§18.2): cache, rate limiting, SSE pub/sub.
module "redis" {
  source = "./modules/redis"

  name_prefix             = local.name_prefix
  vpc_id                  = var.vpc_id
  subnet_ids              = var.private_subnet_ids
  node_type               = var.redis_node_type
  allowed_security_groups = [module.kubernetes.node_security_group_id]
  tags                    = local.common_tags
}

# Private, versioned object storage (§18.2): uploads + async report exports.
module "object_storage" {
  source = "./modules/object_storage"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# CDN + WAF for public web assets and the public edge (§18.2).
module "cdn_waf" {
  source = "./modules/cdn_waf"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix         = local.name_prefix
  public_domain       = var.public_domain
  acm_certificate_arn = var.acm_certificate_arn
  origin_bucket_name  = module.object_storage.bucket_name
  origin_bucket_arn   = module.object_storage.bucket_arn
  tags                = local.common_tags
}
