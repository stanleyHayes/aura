# Staging variable values (§17 environments: prod-like, smaller). Apply:
#   terraform plan  -var-file=environments/staging/terraform.tfvars
#   terraform apply -var-file=environments/staging/terraform.tfvars

environment = "staging"
region      = "eu-west-2"

vpc_id             = "vpc-REPLACE_ME"
private_subnet_ids = ["subnet-REPLACE_A", "subnet-REPLACE_B"]

eks_cluster_name = "cbs-staging"

postgres_instance_class        = "db.t4g.large"
postgres_allocated_storage_gb  = 50
postgres_backup_retention_days = 7
create_read_replica            = true

redis_node_type = "cache.t4g.medium"

public_domain       = "staging.cbs.example.edu"
acm_certificate_arn = "arn:aws:acm:us-east-1:000000000000:certificate/REPLACE_ME"

tags = {
  CostCentre = "estates-it"
  Owner      = "platform-team"
}
