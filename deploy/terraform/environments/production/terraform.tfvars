# Production variable values (§17 environments). Apply from the repo root:
#   terraform init   # configure the s3 backend key for production first
#   terraform plan  -var-file=environments/production/terraform.tfvars
#   terraform apply -var-file=environments/production/terraform.tfvars
#
# Replace the placeholder IDs/ARNs with the real values for the institution.

environment = "production"
region      = "eu-west-2"

vpc_id             = "vpc-REPLACE_ME"
private_subnet_ids = ["subnet-REPLACE_A", "subnet-REPLACE_B", "subnet-REPLACE_C"]

eks_cluster_name = "cbs-production"

postgres_instance_class        = "db.r6g.xlarge"
postgres_allocated_storage_gb  = 200
postgres_backup_retention_days = 30
create_read_replica            = true

redis_node_type = "cache.r7g.large"

public_domain       = "cbs.example.edu"
acm_certificate_arn = "arn:aws:acm:us-east-1:000000000000:certificate/REPLACE_ME"

tags = {
  CostCentre = "estates-it"
  Owner      = "platform-team"
}
