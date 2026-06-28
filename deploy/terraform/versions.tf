# Provider and Terraform version constraints (§18.2 IaC).
# Skeleton targets AWS as the reference cloud; swap the provider blocks per
# institution. Modules are written provider-agnostic where practical.
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state with locking. Provision the backend bucket + lock table once,
  # out of band, then uncomment. Per-environment keys keep state isolated.
  # backend "s3" {
  #   bucket         = "cbs-terraform-state"
  #   key            = "cbs/<environment>/terraform.tfstate"
  #   region         = "eu-west-2"
  #   dynamodb_table = "cbs-terraform-locks"
  #   encrypt        = true
  # }
}
