terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source = "hashicorp/aws"
      # CloudFront + CLOUDFRONT-scoped WAF must be created in us-east-1; the root
      # supplies an aliased provider via the aws.us_east_1 configuration alias.
      version               = "~> 5.40"
      configuration_aliases = [aws.us_east_1]
    }
  }
}
